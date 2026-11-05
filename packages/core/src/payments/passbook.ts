import {
  ADVANCE_MAX_PERCENT,
  type Agree,
  EngagementStatus,
  type Payment,
  PaymentStatus,
  Role,
  type UserId,
} from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { localDay, recurs } from "../job/when.js";
import { OPEN_PAYMENT } from "./book.js";

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
  /** What nobody has asked to be paid yet on done jobs: the signed price, less any advance. */
  notAsked: number;
}

const S = PaymentStatus.enum;
const E = EngagementStatus.enum;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** `Date.getUTCDay()` counts from Sunday; the passbook's week starts on Monday. */
const MONDAY = 1;
/** Length of "YYYY-MM" at the start of a "YYYY-MM-DD" day. */
const MONTH_LENGTH = 7;
/** The work is still to be finished, so an advance is the only money to ask for. */
const WORK_AHEAD: ReadonlySet<EngagementStatus> = new Set([E.agreed, E.in_progress]);
/** Work that is finished, so money is due whether or not anyone has asked for it. */
export const FINISHED_WORK: ReadonlySet<EngagementStatus> = new Set([E.delivered, E.closed]);

/** The calendar month ("YYYY-MM") of a "YYYY-MM-DD" day. */
export const monthOf = (day: string): string => day.slice(0, MONTH_LENGTH);

/** A job both sides signed, on the same terms. */
export type SignedJob = JobRecord & { mine: Agree; theirs: Agree };

/** Both sides signed the same terms: only then is a job GigSync evidence, whichever side this phone was on. */
export function bothSigned(r: JobRecord): r is SignedJob {
  return r.mine !== undefined && r.theirs !== undefined && r.mine.terms_hash === r.theirs.terms_hash;
}

/** Signed work that is this phone's own: it was the provider. */
const signedWork = (r: JobRecord): r is SignedJob => r.engagement.role === Role.enum.provider && bothSigned(r);

/** This phone's own work on its passbook: signed by both, or refilled from its record on GigSync. */
const ownWork = (r: JobRecord): boolean => signedWork(r) || (r.engagement.role === Role.enum.provider && !!r.restored);

/** The price both agreed: from the signed terms, or from the record for a restored job. */
export const agreedPrice = (r: JobRecord): number => r.mine?.terms.price_paise ?? r.restored?.price_paise ?? 0;

/** Work this phone did and finished, on terms both sides signed: what the mentor rule counts. */
export const doneWork = (r: JobRecord): r is SignedJob => signedWork(r) && FINISHED_WORK.has(r.engagement.status);

const filedAt = (p: Payment, r: JobRecord) =>
  new Date(p.confirmed_at ?? p.paid_at ?? p.requested_at ?? r.engagement.created_at);

/** The first and last day ("YYYY-MM-DD") of the local week around `now`. */
function weekOf(now: Date, offsetMinutes: number): { first: string; last: string } {
  const today = new Date(`${localDay(now, offsetMinutes)}T00:00:00Z`);
  const sinceMonday = (today.getUTCDay() - MONDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const first = new Date(today.getTime() - sinceMonday * MS_PER_DAY);
  const last = new Date(first.getTime() + (DAYS_PER_WEEK - 1) * MS_PER_DAY);
  return { first: localDay(first, 0), last: localDay(last, 0) };
}

/** What is left of the signed price: a payment asked for, paid or confirmed counts against it; a disputed one does not. */
export function balanceDue(job: JobRecord, payments: readonly Payment[]): number {
  const counted = payments.filter((p) => p.engagement === job.engagement.id && p.status !== S.disputed);
  return Math.max(0, agreedPrice(job) - counted.reduce((sum, p) => sum + p.amount_paise, 0));
}

/** One-off work is asked for once it is done; work that recurs is asked for by the period, as it goes. */
export const askableNow = (job: JobRecord): boolean => recurs(job.request) || FINISHED_WORK.has(job.engagement.status);

/** The most an advance may be on this job. */
export const advanceCap = (job: JobRecord): number => Math.floor((agreedPrice(job) * ADVANCE_MAX_PERCENT) / 100);

/** A one-off job not yet handed over, with nothing asked for so far: one advance a job, and none on recurring work. */
export function canAskAdvance(job: JobRecord, payments: readonly Payment[]): boolean {
  const counted = payments.some((p) => p.engagement === job.engagement.id && p.status !== S.disputed);
  return !counted && !recurs(job.request) && WORK_AHEAD.has(job.engagement.status);
}

/** Rows newest first, and the totals, for the phone `offsetMinutes` ahead of UTC. */
export function passbook(
  jobs: readonly JobRecord[],
  payments: readonly Payment[],
  me: UserId,
  now: Date,
  offsetMinutes: number,
): { rows: PassbookRow[]; totals: PassbookTotals } {
  const signed = new Map(jobs.filter(ownWork).map((r) => [r.engagement.id, r]));
  const rows: PassbookRow[] = [];
  for (const payment of payments) {
    const job = signed.get(payment.engagement);
    if (job && payment.payee === me) rows.push({ job, payment, at: filedAt(payment, job) });
  }
  rows.sort((a, b) => b.at.getTime() - a.at.getTime() || b.payment.id.localeCompare(a.payment.id));

  const week = weekOf(now, offsetMinutes);
  const month = monthOf(localDay(now, offsetMinutes));
  const totals: PassbookTotals = { week: 0, month: 0, waiting: 0, notAsked: 0 };
  for (const { payment: p } of rows) {
    if (OPEN_PAYMENT.has(p.status)) totals.waiting += p.amount_paise;
    if (p.status !== S.confirmed || !p.confirmed_at) continue;
    const day = localDay(new Date(p.confirmed_at), offsetMinutes);
    if (day >= week.first && day <= week.last) totals.week += p.amount_paise;
    if (monthOf(day) === month) totals.month += p.amount_paise;
  }
  const mine = rows.map((row) => row.payment);
  for (const job of signed.values()) {
    if (FINISHED_WORK.has(job.engagement.status)) totals.notAsked += balanceDue(job, mine);
  }
  return { rows, totals };
}

/** Why the worker may ask again on a job already asked for: after a dispute, or for a new month of monthly work. */
export const AskAgain = { dispute: "dispute", month: "month" } as const;
export type AskAgain = (typeof AskAgain)[keyof typeof AskAgain];

/** Monthly work is asked for again once the last confirmed payment is this old. */
const MONTHLY_REPEAT_DAYS = 28;

/** Milliseconds since the epoch, or 0 for a missing stamp; offsets differ between phones, so never compare the text. */
const ms = (at: string | undefined) => (at ? Date.parse(at) : 0);

/** Undefined when asking again is not offered, e.g. a one-off job that has been paid. */
export function askAgain(job: JobRecord, payments: readonly Payment[], now: Date): AskAgain | undefined {
  const mine = payments
    .filter((p) => p.engagement === job.engagement.id)
    .sort((a, b) => ms(b.requested_at) - ms(a.requested_at) || b.id.localeCompare(a.id));
  if (mine[0]?.status === S.disputed) return AskAgain.dispute;
  if (!recurs(job.request) || mine.some((p) => OPEN_PAYMENT.has(p.status))) return undefined;
  const confirmed = mine.filter((p) => p.status === S.confirmed).map((p) => ms(p.confirmed_at));
  if (confirmed.length === 0) return undefined;
  return now.getTime() - Math.max(...confirmed) >= MONTHLY_REPEAT_DAYS * MS_PER_DAY ? AskAgain.month : undefined;
}
