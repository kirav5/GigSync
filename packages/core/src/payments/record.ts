import {
  type EngagementId,
  EngagementStatus,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  Role,
  type UserId,
} from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { dayOf, EVERY_DAY, localDay } from "../job/when.js";
import { OPEN_PAYMENT } from "./book.js";
import { agreedPrice, bothSigned, FINISHED_WORK, monthOf } from "./passbook.js";

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
  /** The signed day, else the day it was handed over: midday of that day on the phone. */
  day: Date;
  price_paise: number;
  state: RecordState;
  /** The confirmed payment behind `received` or `cash`, or the open one behind `waiting`. */
  payment?: Payment;
}

/** One calendar month of rows, in the phone's local time: `month` is "YYYY-MM". */
export interface RecordMonth<T = RecordRow> {
  month: string;
  rows: T[];
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
  /** Jobs this phone signed as provider, finished or not: none means there is nothing to show yet. */
  signed: number;
}

const E = EngagementStatus.enum;
const S = PaymentStatus.enum;
const MS_PER_MINUTE = 60_000;
/** Midday, so a day shown in the phone's own zone never slips to the date before or after. */
const NOON_UTC = "T12:00:00Z";
/** Provider work that belongs in the record: handed over, or cancelled after both signed. */
const RECORDED: ReadonlySet<EngagementStatus> = new Set([...FINISHED_WORK, E.cancelled]);

/** A row with the local day ("YYYY-MM-DD") it is filed under, for grouping and order. */
export interface Filed<T> {
  key: string;
  row: T;
}

/** A job's local day, as the key it is filed under and as the instant shown for it. */
type Dating = (job: JobRecord) => { key: string; day: Date };

/** The instant of midday on `day` ("YYYY-MM-DD") on a phone `offsetMinutes` ahead of UTC. */
export const middayOf = (day: string, offsetMinutes: number) =>
  new Date(Date.parse(day + NOON_UTC) - offsetMinutes * MS_PER_MINUTE);

/**
 * The local day a job is filed under: the day both signed for, when the request named one and it has come; else the
 * day of the engagement's last move. For delivered work that move is the hand-over; a close (review, receipt) or a
 * cancellation moves it later, and no closer stamp exists: signatures and notes carry no time. Work handed over before
 * its day is filed when it was done, so no row sits in the future.
 */
export function workDay(job: JobRecord, today: string, offsetMinutes: number): string {
  const signed = dayOf(job.request);
  if (signed !== undefined && signed !== EVERY_DAY && signed <= today) return signed;
  return localDay(new Date(job.engagement.updated_at), offsetMinutes);
}

/** When a payment last moved; offsets differ between phones, so stamps are compared as instants. */
const movedAt = (p: Payment) => Date.parse(p.confirmed_at ?? p.paid_at ?? p.requested_at ?? "") || 0;

/** The payment that moved last among `payments`, if any. */
const latest = (payments: readonly Payment[]): Payment | undefined =>
  [...payments].sort((a, b) => movedAt(b) - movedAt(a) || b.id.localeCompare(a.id))[0];

/**
 * The newest live payment decides the chip: a monthly job paid last month and asked again this month is waiting, not
 * received. A disputed payment never counts, so a job whose only payment was disputed reads as not asked.
 */
function moneyOf(job: JobRecord, toMe: readonly Payment[]): Pick<RecordRow, "state" | "payment"> {
  const live = latest(toMe.filter((p) => p.status === S.confirmed || OPEN_PAYMENT.has(p.status)));
  if (live?.status === S.confirmed) {
    const cash = live.method === PaymentMethod.enum.cash;
    return { state: cash ? RecordState.cash : RecordState.received, payment: live };
  }
  if (live) return { state: RecordState.waiting, payment: live };
  return { state: job.engagement.status === E.cancelled ? RecordState.cancelled : RecordState.notAsked };
}

/** Payments grouped by their job. */
function byJob(payments: readonly Payment[]): Map<EngagementId, Payment[]> {
  const out = new Map<EngagementId, Payment[]>();
  for (const p of payments) out.set(p.engagement, [...(out.get(p.engagement) ?? []), p]);
  return out;
}

/** Newest day first; on the same day, the job that moved last first. */
export function newestFirst<T extends { job: JobRecord }>(a: Filed<T>, b: Filed<T>): number {
  const [x, y] = [a.row.job.engagement, b.row.job.engagement];
  return b.key.localeCompare(a.key) || Date.parse(y.updated_at) - Date.parse(x.updated_at) || y.id.localeCompare(x.id);
}

/** Rows into months, keeping their order: newest month first when the rows are newest first. */
export function intoMonths<T>(filed: readonly Filed<T>[]): RecordMonth<T>[] {
  const months: RecordMonth<T>[] = [];
  for (const { key, row } of filed) {
    const month = monthOf(key);
    const last = months.at(-1);
    if (last?.month === month) last.rows.push(row);
    else months.push({ month, rows: [row] });
  }
  return months;
}

/**
 * The worker's record (round2-spec §2): every job this phone did as provider that both sides signed and that is
 * finished or was cancelled after signing, grouped by local month. Only what both sides signed counts, and nothing here counts days or claims anything beyond the jobs themselves.
 */
export function workRecord(
  jobs: readonly JobRecord[],
  payments: readonly Payment[],
  me: UserId,
  now: Date,
  offsetMinutes: number,
): WorkRecord {
  const today = localDay(now, offsetMinutes);
  const dated: Dating = (job) => {
    const key = workDay(job, today, offsetMinutes);
    return { key, day: middayOf(key, offsetMinutes) };
  };
  // A job refilled from the record on GigSync counts as it did on the phone it was signed on.
  const signed = jobs.filter((job) => bothSigned(job) || job.restored !== undefined);
  const provided = signed.filter((job) => job.engagement.role === Role.enum.provider);
  const toMe = byJob(payments.filter((p) => p.payee === me));

  const filed = provided
    .filter((job) => RECORDED.has(job.engagement.status))
    .map((job): Filed<RecordRow> => {
      const { key, day } = dated(job);
      const money = moneyOf(job, toMe.get(job.engagement.id) ?? []);
      return { key, row: { job, day, price_paise: agreedPrice(job), ...money } };
    })
    .sort(newestFirst);

  const done = filed.filter(({ row }) => row.job.engagement.status !== E.cancelled);
  const oldest = done.at(-1);
  return {
    months: intoMonths(filed),
    jobs: done.length,
    households: new Set(done.map(({ row }) => row.job.engagement.counterpart)).size,
    ...(oldest ? { since: oldest.row.day } : {}),
    signed: provided.length,
  };
}
