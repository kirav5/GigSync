import type { Payment, UserId } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { NotBuiltError } from "../not-built.js";

/**
 * The worker's passbook: only jobs both sides signed on GigSync, and only payments to this worker. Entries a worker
 * typed alone are not evidence; these are.
 */

/** One payment in the passbook, with its job. `at` is the moment it is filed under: received, paid or asked. */
export interface PassbookRow {
  job: JobRecord;
  payment: Payment;
  at: Date;
}

/** Sums in paise. A disputed payment counts in none of them. */
export interface PassbookTotals {
  /** Confirmed this week, Monday to Sunday in local time. */
  week: number;
  /** Confirmed this calendar month, in local time. */
  month: number;
  /** Asked for, or marked paid by the customer, and not yet confirmed. */
  waiting: number;
  /** Done jobs nobody has asked to be paid for yet, at the signed price. */
  notAsked: number;
}

/** Rows newest first, and the totals, for the phone `offsetMinutes` ahead of UTC. */
export function passbook(
  _jobs: readonly JobRecord[],
  _payments: readonly Payment[],
  _me: UserId,
  _now: Date,
  _offsetMinutes: number,
): { rows: PassbookRow[]; totals: PassbookTotals } {
  throw new NotBuiltError("passbook");
}

/** Why the worker may ask again on a job already asked for: after a dispute, or for a new month of monthly work. */
export const AskAgain = { dispute: "dispute", month: "month" } as const;
export type AskAgain = (typeof AskAgain)[keyof typeof AskAgain];

/** Undefined when asking again is not offered, e.g. a one-off job that has been paid. */
export function askAgain(_job: JobRecord, _payments: readonly Payment[], _now: Date): AskAgain | undefined {
  throw new NotBuiltError("askAgain");
}
