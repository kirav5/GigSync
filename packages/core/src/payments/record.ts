import type { Payment, UserId } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { NotBuiltError } from "../not-built.js";

/** Where a finished job stands with its money, as one chip on its row. */
export const RecordState = {
  received: "received",
  cash: "cash",
  waiting: "waiting",
  notAsked: "not_asked",
  cancelled: "cancelled",
} as const;
export type RecordState = (typeof RecordState)[keyof typeof RecordState];

/** One finished job in the worker's record. */
export interface RecordRow {
  job: JobRecord;
  /** The signed day, else the day it was handed over. */
  day: Date;
  price_paise: number;
  state: RecordState;
  /** The confirmed payment behind `received` or `cash`, or the open one behind `waiting`. */
  payment?: Payment;
}

/** One calendar month of rows, in the phone's local time: `month` is "YYYY-MM". */
export interface RecordMonth {
  month: string;
  rows: RecordRow[];
}

/** A job this phone hired as requester, and what it paid out. Never earnings. */
export interface HiredRow {
  job: JobRecord;
  day: Date;
  price_paise: number;
  paid_paise: number;
}

export interface WorkRecord {
  /** Newest month first, newest row first inside each month. */
  months: RecordMonth[];
  /** Finished jobs, not counting cancelled ones. */
  jobs: number;
  /** Different households across those jobs. */
  households: number;
  /** The day of the oldest finished job; undefined with none. */
  since?: Date;
  hired: HiredRow[];
}

/**
 * The worker's record (round2-spec §2): every job this phone did as provider that both sides signed and that is
 * finished or was cancelled after signing, grouped by local month; and the jobs it hired as requester. No day counts.
 */
export function workRecord(
  _jobs: readonly JobRecord[],
  _payments: readonly Payment[],
  _me: UserId,
  _now: Date,
  _offsetMinutes: number,
): WorkRecord {
  throw new NotBuiltError("workRecord");
}
