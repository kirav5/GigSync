import { EngagementStatus } from "@gigsync/protocol";
import type { JobRecord } from "./store.js";

/**
 * How often an open app checks its mailbox, and how often a sync looks through the phone's own jobs. A check every
 * two seconds for as long as the app stays open is most of what one phone asks of the server; nearly all of those
 * find nothing. So the app checks fast only while something is moving, and steps back to a slow check otherwise.
 */

const MS_PER_SECOND = 1000;
/** The wait between checks while something is moving (ms). */
export const SYNC_FAST_MS = 2 * MS_PER_SECOND;
/** The wait between checks once nothing has moved for a while (ms): the longest an idle open app is behind. */
export const SYNC_SLOW_MS = 30 * MS_PER_SECOND;
/** Each quiet check waits this many times longer than the one before, up to the slow wait. */
export const SYNC_BACKOFF_FACTOR = 2;
/** After the owner did something, an answer is likely: checks stay fast for this long (ms). */
export const SYNC_AFTER_ACTION_MS = 60 * MS_PER_SECOND;
/**
 * A talk counts as moving for this long after its last change (ms). The agents answer each other in seconds, so a
 * request nobody has answered for longer is waiting for a phone that is not open, and the slow check finds its answer.
 */
export const SYNC_TALK_FRESH_MS = 10 * 60 * MS_PER_SECOND;
/** The least time between two looks through the phone's own jobs on syncs that moved nothing (ms). */
export const SWEEP_EVERY_MS = 60 * MS_PER_SECOND;

const S = EngagementStatus.enum;
/** A talk in progress or a signature awaited: the other side's next message may come any moment. */
const IN_TALKS: ReadonlySet<EngagementStatus> = new Set([
  S.sent,
  S.clarifying,
  S.responded,
  S.negotiating,
  S.confirming,
]);

/** What the last check found, for deciding the wait before the next. */
export interface SyncPace {
  /** The wait before the check that just ended (ms). */
  previousMs: number;
  /** That check took in or sent at least one message. */
  moved: boolean;
  /** A job on this phone is in talks that changed lately (`talksMoving`). */
  talking: boolean;
  /** How long ago the owner last did something here (ms); absent when they have not yet. */
  sinceActionMs?: number | undefined;
}

/** The wait before the next check: fast while something is moving, else a step longer than the last, up to slow. */
export function nextSyncDelay(pace: SyncPace): number {
  const acted = pace.sinceActionMs !== undefined && pace.sinceActionMs < SYNC_AFTER_ACTION_MS;
  if (pace.moved || pace.talking || acted) return SYNC_FAST_MS;
  return Math.min(Math.max(pace.previousMs, SYNC_FAST_MS) * SYNC_BACKOFF_FACTOR, SYNC_SLOW_MS);
}

/** Whether any job this phone answers for is in talks that changed within `SYNC_TALK_FRESH_MS`. */
export function talksMoving(jobs: readonly Pick<JobRecord, "engagement" | "elsewhere">[], now: Date): boolean {
  const freshFrom = now.getTime() - SYNC_TALK_FRESH_MS;
  return jobs.some(
    (job) =>
      !job.elsewhere &&
      IN_TALKS.has(job.engagement.status) &&
      new Date(job.engagement.updated_at).getTime() >= freshFrom,
  );
}

/** Whether a sync should look through the phone's jobs: it moved something, it is the first, or the last is old. */
export function sweepDue(lastSweepMs: number | undefined, nowMs: number, moved: boolean): boolean {
  return moved || lastSweepMs === undefined || nowMs - lastSweepMs >= SWEEP_EVERY_MS;
}
