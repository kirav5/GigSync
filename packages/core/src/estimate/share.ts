import { type EngagementId, EngagementStatus, SharedPrice } from "@gigsync/protocol";
import { type JobRecord, type JobStore, ShareAnswer } from "../job/store.js";
import { log } from "../log.js";
import { bothSigned } from "../payments/passbook.js";
import type { Clock, Storage } from "../ports.js";
import type { EstimateOptions } from "./lookup.js";
import { estimateRequest } from "./scope.js";
import { SharePrices, sharePrices } from "./setting.js";

/**
 * Sharing a signed job's price anonymously, by consent (ADR 0030 §3): asked once per job (or answered by the owner's
 * setting), and only the trade, the city, the area's key, the scope bucket, the price and the month leave the phone,
 * never a user, a name, a contact or the day.
 */

/** Length of "YYYY-MM" at the start of an ISO timestamp. */
const MONTH_LENGTH = 7;

/** A job whose price may be offered for sharing: both signed the same terms, it was not cancelled, nobody answered. */
export const shareDue = (job: JobRecord): boolean =>
  bothSigned(job) && job.price_share === undefined && job.engagement.status !== EngagementStatus.enum.cancelled;

/**
 * What sharing this job sends, or undefined when it cannot be shared anonymously: a point that is no pilot area, a
 * scope the buckets cannot hold (a painting job with no rooms), or anything else the schema refuses.
 */
export function sharedPriceOf(job: JobRecord, options: EstimateOptions, now: Date): SharedPrice | undefined {
  const price = job.mine?.terms.price_paise;
  const area_key = options.areaKey(job.request.area);
  const request = estimateRequest(options.city, job.request.trade, job.request.details);
  if (price === undefined || !area_key || !request) return undefined;
  const month = now.toISOString().slice(0, MONTH_LENGTH);
  return SharedPrice.safeParse({ ...request, area_key, price_paise: price, month }).data;
}

export interface ShareDeps {
  store: JobStore;
  storage: Storage;
  clock: Clock;
  estimates?: EstimateOptions | undefined;
}

/**
 * The owner's answer for one job: yes sends its price, no sends nothing; either way the job is not asked about again.
 * A price that cannot be shared anonymously is recorded as not shared. A failed send leaves it unanswered, to ask
 * again; the error goes to the caller.
 */
export async function answerShare(deps: ShareDeps, id: EngagementId, yes: boolean): Promise<JobRecord | undefined> {
  const job = await deps.store.job(id);
  if (!job || !shareDue(job)) return job;
  const price = yes && deps.estimates ? sharedPriceOf(job, deps.estimates, deps.clock.now()) : undefined;
  if (price && deps.estimates) await deps.estimates.api.sharePrice(price);
  const next: JobRecord = { ...job, price_share: price ? ShareAnswer.yes : ShareAnswer.no };
  await deps.store.saveJob(next);
  return next;
}

/**
 * After a sync: an owner who chose Always shares each newly signed job's price, one who chose Never has each marked
 * not shared; Ask each time leaves them for the card. A failure is logged and tried again on a later sync.
 */
export async function shareBySetting(deps: ShareDeps, jobs: readonly JobRecord[]): Promise<void> {
  const due = jobs.filter(shareDue);
  if (due.length === 0 || !deps.estimates) return;
  const mode = await sharePrices(deps.storage);
  if (mode === SharePrices.ask) return;
  const yes = mode === SharePrices.always;
  await Promise.all(
    due.map((job) =>
      answerShare(deps, job.engagement.id, yes).catch((err: unknown) =>
        log.warn("sharing a price failed", { error: err instanceof Error ? err.name : String(err) }),
      ),
    ),
  );
}
