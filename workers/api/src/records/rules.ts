import type { ExportedPayment, JobRecordStatus, PaymentReport } from "@gigsync/protocol";
import type { Party } from "../db/job-records.js";
import { AGREED, CANCELLED, Side } from "./sides.js";

/** What a status change does: nothing (already there), the change, or a refusal (the job is already final). */
export const StatusMove = { same: "same", change: "change", refuse: "refuse" } as const;
export type StatusMove = (typeof StatusMove)[keyof typeof StatusMove];

/** Either side moves an agreed job to done or cancelled, once; asking for the status it already has is a no-op. */
export function statusMove(current: JobRecordStatus, wanted: JobRecordStatus): StatusMove {
  if (current === wanted) return StatusMove.same;
  return current === AGREED ? StatusMove.change : StatusMove.refuse;
}

/** Money and stars belong to jobs that went ahead. */
export const isCancelled = (p: Party): boolean => p.status === CANCELLED;

/** Only the household gives stars (ADR 0038 §2). */
export const isHousehold = (p: Party): boolean => p.side === Side.household;

/** Only the worker, who received the money, confirms a payment (ADR 0038 §2). */
export const isWorker = (p: Party): boolean => p.side === Side.worker;

/** The same payment reported again (a retry), as opposed to an id reused for a different one. */
export const samePayment = (stored: ExportedPayment, report: PaymentReport): boolean =>
  stored.amount_paise === report.amount_paise && stored.paid_on === report.paid_on && stored.method === report.method;
