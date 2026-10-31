import { groupJobs, type Records, recordsOf } from "@gigsync/core";
import { useMemo } from "react";
import type { GigView } from "../../useGig.js";
import { phoneDay } from "../jobGroups.js";

/**
 * Records' jobs on this phone, filed exactly as Activity files them: a job leaves Activity's Agreed (or Awaiting you)
 * for Records and is counted under Closed, never in both places.
 */
export function useRecords({ jobs, tasks, payments }: GigView, now: Date): Records {
  const day = phoneDay(now);
  return useMemo(() => recordsOf(groupJobs({ jobs, tasks, payments, day }).earlier), [jobs, tasks, payments, day]);
}

/** The phone's offset from UTC, in minutes: where its weeks and months begin. */
export const phoneOffset = (now: Date): number => -now.getTimezoneOffset();
