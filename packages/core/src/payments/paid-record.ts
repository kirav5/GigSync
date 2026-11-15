import { type EngagementId, type Payment, PaymentStatus, type UserId } from "@gigsync/protocol";
import { workDone } from "../job/groups.js";
import type { JobRecord } from "../job/store.js";
import { localDay } from "../job/when.js";
import { receiptsOf } from "./receipts.js";
import { type Filed, intoMonths, middayOf, newestFirst, type RecordMonth, workDay } from "./record.js";

/** One completed job in a household's Records, with what they paid for it. */
export interface PaidRow {
  job: JobRecord;
  /** The signed day, else the day the job last moved: midday of that day on the phone. */
  day: Date;
  /** What the household said it paid on this job, in paise; 0 when no payment was noted on GigSync. */
  paid_paise: number;
  /** Every payment counted in `paid_paise` was confirmed by the worker. */
  confirmed: boolean;
  /** The payments behind `paid_paise`, newest first: how it was paid and the UPI references. */
  payments: Payment[];
}

/** A household's Records: completed jobs by month, newest first, and all they paid on them. */
export interface PaidRecord {
  months: RecordMonth<PaidRow>[];
  paid_paise: number;
}

/**
 * A household's completed work for Money: Records' (`done`, from core's `recordsOf`), and one-off work handed over and
 * paid that Activity still keeps for the household's review. Its money is in Money's total, so its row is under it:
 * never "Nothing completed yet" under a total paid.
 */
export function paidWork(
  done: readonly JobRecord[],
  jobs: readonly JobRecord[],
  payments: readonly Payment[],
  me: UserId,
): JobRecord[] {
  const filed = new Set<EngagementId>(done.map((j) => j.engagement.id));
  const reviewing = new Map<EngagementId, JobRecord>();
  for (const { job } of receiptsOf(jobs, payments, me)) {
    if (workDone(job) && !filed.has(job.engagement.id)) reviewing.set(job.engagement.id, job);
  }
  return [...done, ...reviewing.values()];
}

/**
 * What a household paid for its completed work (`done`, from `paidWork`): one row per job, filed by its day
 * the way the worker's record files it, so both sides see a job under the same month.
 */
export function paidRecord(
  done: readonly JobRecord[],
  payments: readonly Payment[],
  me: UserId,
  now: Date,
  offsetMinutes: number,
): PaidRecord {
  const today = localDay(now, offsetMinutes);
  const paid = new Map<EngagementId, Payment[]>();
  for (const { payment } of receiptsOf(done, payments, me)) {
    paid.set(payment.engagement, [...(paid.get(payment.engagement) ?? []), payment]);
  }
  const filed = done
    .map((job): Filed<PaidRow> => {
      const key = workDay(job, today, offsetMinutes);
      const mine = paid.get(job.engagement.id) ?? [];
      const paid_paise = mine.reduce((sum, p) => sum + p.amount_paise, 0);
      const confirmed = mine.length > 0 && mine.every((p) => p.status === PaymentStatus.enum.confirmed);
      return { key, row: { job, day: middayOf(key, offsetMinutes), paid_paise, confirmed, payments: mine } };
    })
    .sort(newestFirst);
  return { months: intoMonths(filed), paid_paise: filed.reduce((sum, { row }) => sum + row.paid_paise, 0) };
}
