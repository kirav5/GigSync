import { type EngagementId, EngagementStatus, Role, type Terms, type TermWhen } from "@gigsync/protocol";
import { listBookings } from "../schedule/store.js";
import { type Hours, overlaps, spanOf } from "../schedule/windows.js";
import type { JobContext } from "./context.js";
import type { JobRecord } from "./store.js";

/**
 * The times a worker has given (ADR 0048 §5): what their agent may not offer or sign again. A worker's phone answers
 * one message at a time, so reading these just before signing is enough on one phone; a second phone of the same
 * worker does not see them (ADR 0048 §8).
 */

const R = Role.enum;
const S = EngagementStatus.enum;

const isMine = (j: JobRecord) => j.engagement.role === R.provider && j.mine !== undefined && !j.cancel;

/** The terms of the jobs this worker has already agreed to, both sides signed, that set a time. */
export function bookedTerms(jobs: readonly JobRecord[]): (Terms & { when: TermWhen })[] {
  return jobs.flatMap((j) => {
    const terms = isMine(j) && j.mine?.terms_hash === j.theirs?.terms_hash ? j.mine?.terms.terms : undefined;
    return terms?.when ? [{ ...terms, when: terms.when }] : [];
  });
}

/** The times this worker has already agreed to, from jobs both sides signed. */
export const bookedTimes = (jobs: readonly JobRecord[]): TermWhen[] => bookedTerms(jobs).map((t) => t.when);

/**
 * The time signed jobs hold, and the time of a deal this worker signed that waits for the household's signature: two
 * households must not both get it while the first is still signing. Each as the minutes of its day it takes.
 */
export function heldTimes(jobs: readonly JobRecord[]): Hours[] {
  return jobs.flatMap((j) => {
    const signed = isMine(j) && (j.mine?.terms_hash === j.theirs?.terms_hash || j.engagement.status === S.confirming);
    const terms = signed ? j.mine?.terms.terms : undefined;
    return terms?.when ? [spanOf(terms.when, terms.hours)] : [];
  });
}

/** Every time the worker cannot give to `except`'s job: held by another job, or one of their own bookings. */
export async function takenTimes(ctx: JobContext, except?: EngagementId): Promise<Hours[]> {
  const [jobs, bookings] = await Promise.all([ctx.store.jobs(), listBookings(ctx.storage)]);
  return [...heldTimes(jobs.filter((j) => j.engagement.id !== except)), ...bookings];
}

/** The terms give the worker's time to this job although another job or a booking already has it. */
export async function timeTaken(ctx: JobContext, r: JobRecord, terms: Terms | undefined): Promise<boolean> {
  const when = terms?.when;
  if (r.engagement.role !== R.provider || !when) return false;
  const span = spanOf(when, terms.hours);
  return (await takenTimes(ctx, r.engagement.id)).some((t) => overlaps(t, span));
}
