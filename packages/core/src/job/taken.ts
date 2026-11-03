import { type EngagementId, EngagementStatus, Role, type Terms, type TermWhen } from "@gigsync/protocol";
import { listBookings } from "../schedule/store.js";
import { bookingWhens } from "../schedule/windows.js";
import type { JobContext } from "./context.js";
import type { JobRecord } from "./store.js";
import { clashes } from "./terms.js";

/**
 * The times a worker has given (ADR 0048 §5): what their agent may not offer or sign again. A worker's phone answers
 * one message at a time, so reading these just before signing is enough on one phone; a second phone of the same
 * worker does not see them (ADR 0048 §8).
 */

const R = Role.enum;
const S = EngagementStatus.enum;

const isMine = (j: JobRecord) => j.engagement.role === R.provider && j.mine !== undefined && !j.cancel;

/** The times this worker has already agreed to, from jobs both sides signed. */
export function bookedTimes(jobs: readonly JobRecord[]): TermWhen[] {
  return jobs.flatMap((j) => {
    const when = isMine(j) && j.mine?.terms_hash === j.theirs?.terms_hash ? j.mine?.terms.terms?.when : undefined;
    return when ? [when] : [];
  });
}

/**
 * The times signed jobs hold, and the time of a deal this worker signed that waits for the household's signature: two
 * households must not both get it while the first is still signing.
 */
export function heldTimes(jobs: readonly JobRecord[]): TermWhen[] {
  const waiting = jobs.flatMap((j) => {
    const when = isMine(j) && j.engagement.status === S.confirming ? j.mine?.terms.terms?.when : undefined;
    return when ? [when] : [];
  });
  return [...bookedTimes(jobs), ...waiting];
}

/** Every time the worker cannot give to `except`'s job: held by another job, or one of their own bookings. */
export async function takenTimes(ctx: JobContext, except?: EngagementId): Promise<TermWhen[]> {
  const [jobs, bookings] = await Promise.all([ctx.store.jobs(), listBookings(ctx.storage)]);
  return [...heldTimes(jobs.filter((j) => j.engagement.id !== except)), ...bookingWhens(bookings)];
}

/** The terms give the worker's time to this job although another job or a booking already has it. */
export async function timeTaken(ctx: JobContext, r: JobRecord, terms: Terms | undefined): Promise<boolean> {
  const when = terms?.when;
  if (r.engagement.role !== R.provider || !when) return false;
  return (await takenTimes(ctx, r.engagement.id)).some((t) => clashes(t, when));
}
