import {
  type Agree,
  type Answers,
  type Cancel as CancelBody,
  type Clarify,
  COLLEAGUE_KINDS,
  type ContactRelease,
  type DeviceId,
  type EngagementId,
  EngagementStatus,
  EnvelopeKind,
  type JobProblem,
  type JobRequest,
  type JobReview,
  MENTOR_KINDS,
  type Note,
  type Offer,
  type PaymentRecord,
  type PaymentRequest,
  QR_KINDS,
  Role,
  SIDE_CHANNEL_KINDS,
  type UserId,
} from "@gigsync/protocol";
import type { ContactKeeper } from "../contacts/keeper.js";
import { apply, TransitionError } from "../engagement/machine.js";
import { log } from "../log.js";
import type { Received } from "../mail/transport.js";
import type { Mentors } from "../mentor/mentors.js";
import type { WorkOffers } from "../qr/offers.js";
import * as after from "./aftercare.js";
import { mirror } from "./claim.js";
import * as consumer from "./consumer.js";
import type { JobContext } from "./context.js";
import * as deal from "./deal.js";
import { stamped, withNote } from "./history.js";
import type { JobRecord, Need } from "./store.js";
import * as worker from "./worker.js";
import * as workerTime from "./worker-time.js";

const K = EnvelopeKind.enum;
const R = Role.enum;

/** Which kinds each side may receive; anything else from the other party is ignored. */
const RECEIVES: Readonly<Record<Role, ReadonlySet<EnvelopeKind>>> = {
  [R.provider]: new Set([
    K.request,
    K.response,
    K.counter,
    K.agree,
    K.contact_release,
    K.cancel,
    K.payment_record,
    K.review,
    K.problem,
  ]),
  [R.requester]: new Set([
    K.clarify,
    K.quote,
    K.agree,
    K.contact_release,
    K.cancel,
    K.update,
    K.delivery,
    K.payment_request,
    K.payment_record,
    K.problem,
  ]),
};

export class DispatchError extends Error {}

/** The consumer's need behind a job; every consumer job has one. */
export async function needOf(ctx: JobContext, r: JobRecord): Promise<Need> {
  const need = await ctx.store.need(r.engagement.group);
  if (!need) throw new DispatchError(`no need for ${r.engagement.id}`);
  return need;
}

/** Where envelopes toward and on mentor links, and offers to work from a QR, go: they belong to no job. */
export interface SideInboxes {
  mentors: Pick<Mentors, "receive">;
  offers: Pick<WorkOffers, "receive">;
  /** Problems reported on a signed job, which hold its contacts (ADR 0039 §3). */
  contacts: Pick<ContactKeeper, "receive">;
}

/**
 * Takes one verified, opened envelope into its job: only from the job's counterpart, only kinds this side may
 * receive, only moves the engagement allows. Then lets the right agent answer it. Mentor and mentor-link envelopes, and
 * offers to work from a QR, go to their own inboxes and never reach the engagement machine. A `referral` (a colleague suggested on a declined
 * request) can still come from an older build; no side receives it any more, so it is dropped like any stray kind.
 *
 * Roles are per engagement: a phone that asked for the work is the requester of that job, found in the store like
 * any other. Only an incoming `request` for an engagement this phone does not have makes a new worker job.
 */
export async function dispatch(
  ctx: JobContext,
  rules: worker.WorkerRules | undefined,
  item: Received,
  side: SideInboxes,
): Promise<void> {
  const { envelope: e, body } = item;
  if (COLLEAGUE_KINDS.has(e.kind) || MENTOR_KINDS.has(e.kind)) return side.mentors.receive(item);
  if (QR_KINDS.has(e.kind)) return side.offers.receive(item);
  const existing = await ctx.store.job(e.engagement);
  const r =
    existing ??
    (e.kind === K.request && rules ? newWorkerJob(ctx, e.engagement, e.from.user, body as JobRequest) : undefined);
  if (!r || e.from.user !== r.engagement.counterpart || !RECEIVES[r.engagement.role].has(e.kind)) {
    log.warn("envelope not for any job here", { messageId: e.id, kind: e.kind });
    return;
  }
  if (r.elsewhere) return mirror(ctx, r, e.kind, body);
  let moved = r;
  if (!SIDE_CHANNEL_KINDS.has(e.kind)) {
    try {
      const now = ctx.clock.now();
      moved = stamped({ ...r, engagement: apply(r.engagement, e.kind, now) }, now.toISOString());
    } catch (err) {
      if (!(err instanceof TransitionError)) throw err;
      log.warn("envelope out of turn", { messageId: e.id, kind: e.kind, status: r.engagement.status });
      return;
    }
  }
  // A request reaches every device of a worker; only the one that claims it first lets its agent answer (ADR 0045).
  const owner = existing ? ctx.me.device : await ctx.claim(e.engagement);
  if (owner !== ctx.me.device) {
    log.info("request answered on another device", { messageId: e.id, engagement: e.engagement });
    await ctx.store.saveJob({ ...moved, elsewhere: owner });
    return;
  }
  await ctx.store.saveJob(moved);
  if (e.kind === K.problem) return side.contacts.receive(moved, body as JobProblem);
  await react(ctx, rules, moved, e.kind, body, e.from.device);
}

async function react(
  ctx: JobContext,
  w: worker.WorkerRules | undefined,
  r: JobRecord,
  kind: EnvelopeKind,
  body: unknown,
  from: DeviceId,
): Promise<void> {
  switch (kind) {
    case K.request:
      if (w) await worker.onRequest(ctx, w, r);
      return;
    case K.response:
      if (w) await worker.onAnswers(ctx, w, r, body as Answers);
      return;
    case K.counter:
      if (w) await worker.onCounter(ctx, w, r, body as Offer);
      return;
    case K.clarify:
      await consumer.onClarify(ctx, await needOf(ctx, r), r, body as Clarify);
      return;
    case K.quote:
      await consumer.onQuote(ctx, await needOf(ctx, r), r, body as Offer);
      return;
    case K.agree:
      if (w) await workerTime.onAgree(ctx, w, r, body as Agree, from);
      else await deal.onAgree(ctx, r, body as Agree, from);
      return;
    case K.contact_release:
      await deal.onContact(ctx, r, body as ContactRelease);
      return;
    case K.cancel:
      await deal.onCancel(ctx, r, body as CancelBody);
      return;
    case K.payment_request:
      await after.onPaymentRequest(ctx, r, body as PaymentRequest);
      return;
    case K.payment_record:
      await after.onPaymentRecord(ctx, r, body as PaymentRecord);
      return;
    case K.review:
      await ctx.store.saveJob({ ...r, review: body as JobReview });
      return;
    case K.update:
    case K.delivery:
      await ctx.store.saveJob(withNote(r, body as Note, ctx.clock.now().toISOString()));
      return;
    default:
      return;
  }
}

function newWorkerJob(ctx: JobContext, id: EngagementId, from: UserId, request: JobRequest): JobRecord {
  const at = ctx.clock.now().toISOString();
  return {
    engagement: {
      id,
      group: id,
      role: R.provider,
      counterpart: from,
      status: EngagementStatus.enum.draft,
      brief: { text: request.need, topic: request.trade, shared: request.details },
      created_at: at,
      updated_at: at,
    },
    request,
    offers: [],
    offers_made: 0,
    asked: false,
  };
}
