import { EngagementStatus } from "@gigsync/protocol";
import { bothSigned } from "../payments/passbook.js";
import type { JobGroups } from "./groups.js";
import type { JobRecord } from "./store.js";

const S = EngagementStatus.enum;

/**
 * Activity's tabs, as collab's: what waits on the owner, what the agents are still talking over, and what is agreed.
 * Its fourth counter, Closed, is not a tab: it opens Records, so finished jobs live in one place only.
 */
export const ActivityTab = { awaiting: "awaiting", talks: "talks", agreed: "agreed" } as const;
export type ActivityTab = (typeof ActivityTab)[keyof typeof ActivityTab];

/** Over without the work being completed: cancelled after or before signing, declined, or left to expire. */
export const NOT_COMPLETED: ReadonlySet<EngagementStatus> = new Set([S.cancelled, S.declined, S.expired]);

/** What Records shows: completed work, newest first, and a small fold of jobs that were not completed. */
export interface Records {
  done: JobRecord[];
  notDone: JobRecord[];
}

/** One phone's jobs as Activity and Records show them. */
export interface Activity {
  /** An owner task is open: approve, answer, sign, confirm a payment. */
  awaiting: JobRecord[];
  /** The agents are asking, quoting or waiting for a signature. */
  talks: JobRecord[];
  /** Signed work today, coming up, recurring or with no day, and delivered work whose payment is not confirmed. */
  agreed: Pick<JobGroups, "today" | "upcoming" | "other">;
  records: Records;
}

/** The four counters across the top of Activity. */
export interface ActivityCounts {
  awaiting: number;
  talks: number;
  agreed: number;
  closed: number;
}

/**
 * Completed work, out of the jobs that are over: signed by both sides (or restored from the server's record) and
 * finished. A question that simply closed after an answer was never work, so it is in neither list.
 */
export function recordsOf(earlier: readonly JobRecord[]): Records {
  const notDone = earlier.filter((job) => NOT_COMPLETED.has(job.engagement.status));
  const done = earlier.filter(
    (job) => !NOT_COMPLETED.has(job.engagement.status) && (bothSigned(job) || job.restored !== undefined),
  );
  return { done, notDone };
}

/** The groups as Activity's tabs: decide → Awaiting you, talking → In talks, signed work → Agreed, the rest → Records. */
export function activityOf(groups: JobGroups): Activity {
  const { decide, talking, today, upcoming, other, earlier } = groups;
  return { awaiting: decide, talks: talking, agreed: { today, upcoming, other }, records: recordsOf(earlier) };
}

/** The counters; `moreAwaiting` adds what waits outside the jobs (a household's offers to work from a QR scan). */
export function countsOf(activity: Activity, moreAwaiting = 0): ActivityCounts {
  const { today, upcoming, other } = activity.agreed;
  return {
    awaiting: activity.awaiting.length + moreAwaiting,
    talks: activity.talks.length,
    agreed: today.length + upcoming.length + other.length,
    closed: activity.records.done.length + activity.records.notDone.length,
  };
}

/** The tab Activity opens on: Awaiting you whenever something waits, else the first tab that has anything. */
export function firstTab(counts: ActivityCounts): ActivityTab {
  if (counts.awaiting > 0) return ActivityTab.awaiting;
  if (counts.talks > 0) return ActivityTab.talks;
  if (counts.agreed > 0) return ActivityTab.agreed;
  return ActivityTab.awaiting;
}
