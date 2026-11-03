import {
  EngagementStatus,
  EVERY_DAY,
  type Lang,
  type Payment,
  PaymentStatus,
  PROBLEM_HOLD_DAYS,
  type ProblemReason,
} from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { dayOf, recurs } from "../job/when.js";
import { OPEN_PAYMENT } from "../payments/book.js";
import { bothSigned, FINISHED_WORK } from "../payments/passbook.js";

/**
 * When a job's contact details go (ADR 0039 §3), as a pure rule each phone applies to what it holds. Both phones see
 * the same moves (done, cancelled, the worker's confirmation of a payment, a problem reported or resolved), so both
 * reach the same answer; the cap counts from when each phone first saw the job end.
 */

const S = EngagementStatus.enum;
const P = PaymentStatus.enum;
const MS_PER_DAY = 86_400_000;
/** With no payment confirmed, contacts go this long after the job ended. */
export const SETTLE_CAP_DAYS = 3;

/** Who reported a problem, as this phone sees it. */
export const ProblemBy = { me: "me", them: "them" } as const;
export type ProblemBy = (typeof ProblemBy)[keyof typeof ProblemBy];

/** A problem reported on a job, as this phone keeps it. `told` is false when the other phone could not be told. */
export interface ProblemRecord {
  by: ProblemBy;
  reason: ProblemReason;
  /** The words, if any, and the language they are in, so the other phone can translate them. */
  text?: string;
  lang: Lang;
  opened_at: string;
  resolved_at?: string;
  told: boolean;
}

/** Over: done (handed over or closed) or cancelled. An arrangement is over only when one side ends or cancels it. */
const ENDED: ReadonlySet<EngagementStatus> = new Set([...FINISHED_WORK, S.cancelled]);

/**
 * Monthly or daily work: work that recurs (`recurs`: a cook or maid not asked for one visit or a few hours), or a day
 * of "every day" in the request or the signed terms.
 */
export function isArrangement(job: JobRecord): boolean {
  return recurs(job.request) || dayOf(job.request) === EVERY_DAY || job.mine?.terms.terms?.when?.day === EVERY_DAY;
}

/** The job is over, so its contacts may go once it is paid up or the cap has passed. */
export const hasEnded = (job: JobRecord): boolean => ENDED.has(job.engagement.status);

/** A problem that still holds the contacts: not resolved, and reported less than `PROBLEM_HOLD_DAYS` ago. */
export function problemHolds(problem: ProblemRecord | undefined, now: Date): boolean {
  if (!problem || problem.resolved_at) return false;
  return now.getTime() - Date.parse(problem.opened_at) < PROBLEM_HOLD_DAYS * MS_PER_DAY;
}

/** Milliseconds since the epoch for a payment's last move; offsets differ between phones, so never the text. */
const movedAt = (p: Payment) => Date.parse(p.confirmed_at ?? p.paid_at ?? p.requested_at ?? "") || 0;

/**
 * The money is settled: the last payment that counts (disputed ones never do) is one the worker confirmed, at or after
 * `since` when given, and none is still open. For a one-time job that is its payment, whenever it came; for an
 * arrangement, the last one after it ended, since every month before was paid while it went on.
 */
export function paidUp(payments: readonly Payment[], since?: string): boolean {
  if (payments.some((p) => OPEN_PAYMENT.has(p.status))) return false;
  const last = payments
    .filter((p) => p.status === P.confirmed)
    .sort((a, b) => movedAt(b) - movedAt(a) || b.id.localeCompare(a.id))[0];
  return last !== undefined && (since === undefined || movedAt(last) >= Date.parse(since));
}

/** What a phone needs to decide about one job: the job, its payments, and when it first saw the job end. */
export interface SettleFacts {
  job: JobRecord;
  payments: readonly Payment[];
  /** When this phone first saw the job end; undefined while it has not. */
  endedAt: string | undefined;
}

/**
 * Whether the other side's contact details go now. Only on a job both signed (the only kind that ever had them), not
 * while a problem holds them, and only once it ended: at once when paid up, else `SETTLE_CAP_DAYS` after it ended. An
 * arrangement still under way keeps them, however many months are paid; once ended, its last payment settles it.
 */
export function contactsDue({ job, payments, endedAt }: SettleFacts, now: Date): boolean {
  if (!bothSigned(job) || job.restored || problemHolds(job.problem, now)) return false;
  if (!hasEnded(job) || endedAt === undefined) return false;
  if (paidUp(payments, isArrangement(job) ? endedAt : undefined)) return true;
  return now.getTime() - Date.parse(endedAt) >= SETTLE_CAP_DAYS * MS_PER_DAY;
}
