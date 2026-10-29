import {
  CancelReason,
  type EngagementId,
  EngagementStatus,
  EnvelopeKind,
  type Referral,
  Role,
  TERMINAL_STATUSES,
  type UserId,
} from "@gigsync/protocol";
import { startRequest } from "../job/consumer.js";
import type { JobContext } from "../job/context.js";
import type { JobRecord } from "../job/store.js";
import { log } from "../log.js";
import { ReferralError, ReferralRefusal } from "./errors.js";
import { canReach } from "./link.js";
import type { ColleagueContext } from "./store.js";
import { ColleagueState } from "./types.js";

const K = EnvelopeKind.enum;
const S = EngagementStatus.enum;
const R = Role.enum;

/** A turned-down request on this side of it, unless the household has already taken someone else for the need. */
const passable = (r: JobRecord, role: Role) =>
  r.engagement.role === role && r.engagement.status === S.declined && r.cancel?.reason !== CancelReason.enum.taken;

/** Worker side: on a request this phone declined, suggests a linked colleague to the household. */
export async function suggest(c: ColleagueContext, id: EngagementId, colleague: UserId): Promise<JobRecord> {
  const r = await c.ctx.store.job(id);
  if (!r || !passable(r, R.provider)) throw new ReferralError(ReferralRefusal.notDeclined);
  const linked = await c.store.get(colleague);
  if (linked?.state !== ColleagueState.linked) throw new ReferralError(ReferralRefusal.notLinked);
  if (!(await canReach(c.relay, r.engagement.counterpart))) throw new ReferralError(ReferralRefusal.tooOld);
  const body: Referral = { colleague, card: linked.card };
  return c.ctx.send({ ...r, referred: colleague }, K.referral, body);
}

/** Household side: kept only on a request this phone made that the worker turned down, naming someone else. */
export async function onReferral(ctx: JobContext, r: JobRecord, body: Referral): Promise<JobRecord> {
  const someoneElse = body.colleague !== ctx.me.user && body.colleague !== r.engagement.counterpart;
  if (!passable(r, R.requester) || !someoneElse) {
    log.warn("referral ignored", { engagement: r.engagement.id, status: r.engagement.status });
    return r;
  }
  const at = ctx.clock.now().toISOString();
  const next = { ...r, referral: { colleague: body.colleague, card: body.card, at } };
  await ctx.store.saveJob(next);
  return next;
}

/**
 * Household side: sends the same need (same group, details and budget) as a fresh request to the colleague a worker
 * suggested. Asking again while that request is open returns it instead of asking twice.
 */
export async function askReferred(ctx: JobContext, id: EngagementId): Promise<JobRecord[]> {
  const r = await ctx.store.job(id);
  const referral = r?.referral;
  const need = r ? await ctx.store.need(r.engagement.group) : undefined;
  if (!referral || !need) throw new ReferralError(ReferralRefusal.noReferral);
  const open = (await ctx.store.group(need.group)).filter(
    (o) => o.engagement.counterpart === referral.colleague && !TERMINAL_STATUSES.has(o.engagement.status),
  );
  if (open.length > 0) return open;
  return [await startRequest(ctx, need, referral.colleague)];
}
