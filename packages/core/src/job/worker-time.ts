import { type Agree, CancelReason, type DeviceId, MAX_ROUNDS, Role, type Terms } from "@gigsync/protocol";
import { log } from "../log.js";
import type { JobContext } from "./context.js";
import * as deal from "./deal.js";
import { type JobRecord, TaskKind } from "./store.js";
import { timeTaken } from "./taken.js";
import { workerTerms } from "./terms-flow.js";
import { quote, type WorkerRules } from "./worker.js";

/**
 * One time, one household (ADR 0048 §5): the first household to sign a time gets it. A deal whose time another job or
 * a booking took meanwhile is never signed by the worker's side; their agent offers the next free time instead, at the
 * price already agreed, and ends the talks when no time is free.
 */

/** Re-offers the job at the worker's next free time; the deal that waited for a signature is dropped. */
async function offerAnotherTime(
  ctx: JobContext,
  rules: WorkerRules,
  r: JobRecord,
  asked: Terms | undefined,
  price: number,
): Promise<JobRecord> {
  log.info("time taken: offering another", { engagement: r.engagement.id });
  await ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
  const { r: termed, stuck } = await workerTerms(ctx, rules.terms, { ...r, pending: undefined }, asked);
  // No offers left under the protocol's cap: an offer past it would be refused by the other phone.
  if (stuck || termed.offers_made >= MAX_ROUNDS) return deal.cancel(ctx, termed, { reason: CancelReason.enum.no_deal });
  return quote(ctx, termed, price);
}

/** The household signed the worker's offer: countersign it, unless its time went to someone else meanwhile. */
export async function onAgree(
  ctx: JobContext,
  rules: WorkerRules,
  r: JobRecord,
  theirs: Agree,
  from: DeviceId,
): Promise<JobRecord> {
  // A countersignature completes a deal this side already signed: that time is this job's.
  if (r.mine || !(await timeTaken(ctx, r, theirs.terms.terms))) return deal.onAgree(ctx, r, theirs, from);
  return offerAnotherTime(ctx, rules, r, theirs.terms.terms, theirs.terms.price_paise);
}

/** The worker taps Sign: signed, or offered at another time when this one is no longer free. */
export async function confirm(ctx: JobContext, rules: WorkerRules | undefined, r: JobRecord): Promise<JobRecord> {
  const pending = r.pending;
  if (!rules || !pending || !(await timeTaken(ctx, r, pending.terms))) return deal.sign(ctx, r);
  return offerAnotherTime(ctx, rules, r, pending.terms, pending.price_paise);
}

/**
 * Every deal waiting for the worker's signature whose time is now taken (another job signed, a booking saved) is
 * offered at another time, so the owner is never shown two deals for one morning.
 */
export async function reofferTaken(ctx: JobContext, rules: WorkerRules): Promise<void> {
  const waiting = (await ctx.store.tasks()).filter((t) => t.kind === TaskKind.confirmDeal);
  for (const task of waiting) {
    const r = await ctx.store.job(task.engagement);
    const pending = r?.pending;
    if (!r || !pending || r.engagement.role !== Role.enum.provider) continue;
    if (await timeTaken(ctx, r, pending.terms))
      await offerAnotherTime(ctx, rules, r, pending.terms, pending.price_paise);
  }
}
