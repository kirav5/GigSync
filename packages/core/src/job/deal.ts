import { termsHash, toBase64, verify } from "@gigsync/crypto";
import {
  type Agree,
  type Cancel,
  CancelReason,
  type ContactCard,
  type ContactRelease,
  type DeviceId,
  EngagementStatus,
  EnvelopeKind,
  type JobTerms,
  type Offer,
  Role,
  TERMINAL_STATUSES,
} from "@gigsync/protocol";
import { log } from "../log.js";
import { remember } from "../memory/remember.js";
import type { JobContext } from "./context.js";
import { type JobRecord, TaskKind } from "./store.js";

const K = EnvelopeKind.enum;
const S = EngagementStatus.enum;
const R = Role.enum;
/** Domain separation: an agree signature can never be mistaken for any other signature by the same key. */
const AGREE_PREFIX = "gigsync/agree/v1:";
const agreeBytes = (hash: string) => new TextEncoder().encode(`${AGREE_PREFIX}${hash}`);

/** Statuses in which the job is signed by both and contact cards may travel. */
const SIGNED: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered]);

export class DealError extends Error {}

const workerOf = (ctx: JobContext, r: JobRecord) =>
  r.engagement.role === R.provider ? ctx.me.user : r.engagement.counterpart;
const consumerOf = (ctx: JobContext, r: JobRecord) =>
  r.engagement.role === R.requester ? ctx.me.user : r.engagement.counterpart;

export function termsFor(ctx: JobContext, r: JobRecord, offer: Offer): JobTerms {
  return {
    engagement: r.engagement.id,
    offer_id: offer.offer_id,
    worker: workerOf(ctx, r),
    consumer: consumerOf(ctx, r),
    trade: r.request.trade,
    scope: offer.scope,
    slot: offer.slot,
    price_paise: offer.price_paise,
  };
}

/**
 * A consumer has at most one signature outstanding per need: if two workers could countersign at once, one need
 * would be booked twice. Another deal the agent reaches meanwhile waits for the owner.
 */
async function signingAnother(ctx: JobContext, r: JobRecord): Promise<boolean> {
  if (r.engagement.role !== R.requester) return false;
  const group = await ctx.store.group(r.engagement.group);
  return group.some((o) => o.engagement.id !== r.engagement.id && o.mine && o.engagement.status === S.confirming);
}

/** The agent accepts the other side's offer: the owner signs it, or it is signed at once under auto-confirm. */
export async function accept(ctx: JobContext, r: JobRecord, terms: JobTerms): Promise<JobRecord> {
  const next = { ...r, pending: terms };
  await ctx.store.saveJob(next);
  if (ctx.autoConfirm && !(await signingAnother(ctx, next))) return sign(ctx, next);
  await ctx.store.addTask(TaskKind.confirmDeal, r.engagement.id, terms, ctx.clock.now());
  return next;
}

/** The owner signs the pending terms. Sends `agree`; if the other side already signed the same terms, it is agreed. */
export async function sign(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  if (!r.pending) throw new DealError("no terms to sign");
  if (await signingAnother(ctx, r)) throw new DealError("already signing with another worker for this need");
  const hash = termsHash(r.pending);
  const mine: Agree = { terms: r.pending, terms_hash: hash, sig: toBase64(await ctx.keys.sign(agreeBytes(hash))) };
  await ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
  const sent = await ctx.send({ ...r, mine, pending: undefined }, K.agree, mine);
  return sent.engagement.status === S.agreed ? onAgreed(ctx, sent) : sent;
}

/** The owner refuses the deal their agent reached: the job is cancelled on both sides. */
export function decline(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  return cancel(ctx, r, { reason: CancelReason.enum.declined_by_owner });
}

export async function cancel(ctx: JobContext, r: JobRecord, body: Cancel): Promise<JobRecord> {
  await ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
  await ctx.store.removeTask(TaskKind.answerQuestions, r.engagement.id);
  return ctx.send({ ...r, pending: undefined, cancel: body, contact: undefined }, K.cancel, body);
}

/**
 * The other side signed. Its signature must verify with its device key, over a hash of exactly these terms, for an
 * offer this side made. If this side already signed the same hash, the job is agreed; otherwise it is this side's
 * turn to sign.
 */
export async function onAgree(ctx: JobContext, r: JobRecord, theirs: Agree, from: DeviceId): Promise<JobRecord> {
  const key = await ctx.signingKeyOf(r.engagement.counterpart, from);
  const offer = r.offers.find((o) => o.offer.offer_id === theirs.terms.offer_id);
  // Either they countersign what this side signed, or they sign first, accepting an offer this side made.
  const countersigns = r.mine?.terms_hash === theirs.terms_hash;
  const acceptsMyOffer = !r.mine && offer?.by === r.engagement.role;
  const valid =
    key !== undefined &&
    verify(agreeBytes(theirs.terms_hash), theirs.sig, key) &&
    termsHash(theirs.terms) === theirs.terms_hash &&
    offer !== undefined &&
    termsHash(termsFor(ctx, r, offer.offer)) === theirs.terms_hash &&
    (countersigns || acceptsMyOffer);
  if (!valid) {
    log.warn("agree rejected", { engagement: r.engagement.id });
    return cancel(ctx, r, { reason: CancelReason.enum.other, note: "terms did not match" });
  }
  const next = { ...r, theirs };
  if (countersigns && next.engagement.status === S.agreed) return onAgreed(ctx, next);
  await ctx.store.saveJob(next);
  return accept(ctx, next, theirs.terms);
}

/**
 * The card this side releases. The worker goes to the requester's place, so a provider never sends an address: a
 * worker's saved work site is for a helper they hire, never for the households they work for.
 */
function releasedCard(ctx: JobContext, r: JobRecord): ContactCard {
  if (r.engagement.role === R.requester) return ctx.contact;
  const { address: _site, ...card } = ctx.contact;
  return card;
}

/** Both signed: send this owner's card, and (consumer) release every other request in the group. */
async function onAgreed(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  const hash = r.mine?.terms_hash as string;
  const contact = releasedCard(ctx, r);
  const out = await ctx.send(r, K.contact_release, { terms_hash: hash, contact } satisfies ContactRelease);
  if (r.engagement.role === R.requester) {
    for (const other of await ctx.store.group(r.engagement.group)) {
      if (other.engagement.id === r.engagement.id || TERMINAL_STATUSES.has(other.engagement.status)) continue;
      await cancel(ctx, other, { reason: CancelReason.enum.taken });
    }
  }
  log.info("job agreed", { engagement: r.engagement.id, price: r.mine?.terms.price_paise });
  await remember(ctx, out, await ctx.store.need(out.engagement.group));
  return out;
}

/** The other party's card, accepted only for a job both signed, under the hash both signed. */
export async function onContact(ctx: JobContext, r: JobRecord, body: ContactRelease): Promise<JobRecord> {
  if (!SIGNED.has(r.engagement.status) || body.terms_hash !== r.mine?.terms_hash) {
    log.warn("contact card ignored", { engagement: r.engagement.id, status: r.engagement.status });
    return r;
  }
  const next = { ...r, contact: body.contact };
  await ctx.store.saveJob(next);
  // The card brings the other side's name: the one thing memory keeps from it.
  await remember(ctx, next, await ctx.store.need(next.engagement.group));
  return next;
}

/** The other side ended the job: forget their card and any decision waiting on it. */
export async function onCancel(ctx: JobContext, r: JobRecord, body: Cancel): Promise<JobRecord> {
  await ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
  await ctx.store.removeTask(TaskKind.answerQuestions, r.engagement.id);
  const next = { ...r, cancel: body, pending: undefined, contact: undefined };
  await ctx.store.saveJob(next);
  return next;
}
