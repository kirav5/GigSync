import { PaymentStatus, type UserId } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { localDay } from "../job/when.js";
import { OPEN_PAYMENT } from "./book.js";
import { DAYS_PER_WEEK, MS_PER_DAY, monthOf, type PassbookRow, passbook, weekOf } from "./passbook.js";
import type { Receipt } from "./receipts.js";

/**
 * The Money tab's figures beyond the passbook's totals (design W15, H13): how many payments came this week, who the
 * money still waits on, and a household's own totals. Sums in paise; nothing here is new data, only a reading of it.
 */

const S = PaymentStatus.enum;

/**
 * How many payments were confirmed this week. Each is put through the passbook's own week rule, so the count can never
 * disagree with the week's total shown above it.
 */
export function weekPayments(rows: readonly PassbookRow[], now: Date, offsetMinutes: number): number {
  const inWeek = ({ job, payment }: PassbookRow): boolean =>
    payment.status === S.confirmed && passbook([job], [payment], payment.payee, now, offsetMinutes).totals.week > 0;
  return rows.filter(inWeek).length;
}

/** What came on each day of this local week, Monday first, in paise: the bars under the week's total. */
export function weekDays(rows: readonly PassbookRow[], now: Date, offsetMinutes: number): number[] {
  const week = weekOf(now, offsetMinutes);
  const first = new Date(`${week.first}T00:00:00Z`).getTime();
  const days = new Array<number>(DAYS_PER_WEEK).fill(0);
  for (const { payment } of rows) {
    if (payment.status !== S.confirmed || !payment.confirmed_at) continue;
    const day = localDay(new Date(payment.confirmed_at), offsetMinutes);
    if (day < week.first || day > week.last) continue;
    const at = Math.round((new Date(`${day}T00:00:00Z`).getTime() - first) / MS_PER_DAY);
    days[at] = (days[at] ?? 0) + payment.amount_paise;
  }
  return days;
}

/** Which day of the local week `now` is, Monday 0 to Sunday 6. */
export function weekDayIndex(now: Date, offsetMinutes: number): number {
  const first = new Date(`${weekOf(now, offsetMinutes).first}T00:00:00Z`).getTime();
  return Math.round((new Date(`${localDay(now, offsetMinutes)}T00:00:00Z`).getTime() - first) / MS_PER_DAY);
}

/** Money asked for, or marked paid, that one household has not settled yet: one of its jobs, for its name. */
export interface WaitingFrom {
  household: UserId;
  job: JobRecord;
  paise: number;
}

/** What is waiting, by household, the most first: the passbook's `waiting` total, split by who it waits on. */
export function waitingBy(rows: readonly PassbookRow[]): WaitingFrom[] {
  const by = new Map<UserId, WaitingFrom>();
  for (const { job, payment } of rows) {
    if (!OPEN_PAYMENT.has(payment.status)) continue;
    const household = job.engagement.counterpart;
    const seen = by.get(household);
    by.set(household, { household, job: seen?.job ?? job, paise: (seen?.paise ?? 0) + payment.amount_paise });
  }
  return [...by.values()].sort((a, b) => b.paise - a.paise);
}

/** A household's money, from every payment it said it paid on any job on this phone. */
export interface PaidTotals {
  /** Paid in all, confirmed by the worker or not yet. */
  all: number;
  /** Paid this calendar month, in local time. */
  month: number;
  /** Paid on the household's word, and not yet confirmed by the worker. */
  unconfirmed: number;
  /** When the oldest of those payments was made; undefined with none. */
  since?: Date;
}

const sum = (receipts: readonly Receipt[]): number => receipts.reduce((total, r) => total + r.payment.amount_paise, 0);

/**
 * The Pay tab's head (`receipts` from `receiptsOf`, newest first). Every figure counts the same payments, so "this
 * month" can never be more than "in all", even while a job paid for still waits under Agreed.
 */
export function paidTotals(receipts: readonly Receipt[], now: Date, offsetMinutes: number): PaidTotals {
  const month = monthOf(localDay(now, offsetMinutes));
  const oldest = receipts.at(-1);
  return {
    all: sum(receipts),
    month: sum(receipts.filter((r) => monthOf(localDay(r.at, offsetMinutes)) === month)),
    unconfirmed: sum(receipts.filter((r) => !r.confirmed)),
    ...(oldest ? { since: oldest.at } : {}),
  };
}
