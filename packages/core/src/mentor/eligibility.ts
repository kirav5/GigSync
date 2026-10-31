import { MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { doneWork } from "../payments/passbook.js";

/** Average days in a month: months are counted from days so the count never depends on month lengths. */
const DAYS_PER_MONTH = 30.44;
const MS_PER_DAY = 86_400_000;

/** What this phone's record says about its owner as a mentor: their own count, never checked by anyone else. */
export interface MentorRecord {
  /** Finished jobs this phone did as the worker, signed by both sides. */
  jobs: number;
  /** Whole months since the first of those jobs began; 0 with none. */
  months: number;
  /** Both counts reach the minimum. */
  eligible: boolean;
}

/** Whole months between two instants, counted from days. */
export function monthsBetween(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  return days <= 0 ? 0 : Math.floor(days / DAYS_PER_MONTH);
}

/**
 * The mentor rule (round4-spec §2b), counted on this phone from jobs both sides signed: no steward, union or server
 * approves anyone. The months run from the day the first such job began, the only time every job record carries.
 */
export function mentorRecord(jobs: readonly JobRecord[], now: Date): MentorRecord {
  const done = jobs.filter(doneWork);
  const first = Math.min(...done.map((r) => Date.parse(r.engagement.created_at)));
  const months = done.length === 0 ? 0 : monthsBetween(new Date(first), now);
  return { jobs: done.length, months, eligible: done.length >= MENTOR_MIN_JOBS && months >= MENTOR_MIN_MONTHS };
}
