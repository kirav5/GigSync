import { type EngagementId, type Payment, PaymentStatus, type UserId } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";

/** One payment the owner made, with the job it paid for: a row of a household's Receipts. */
export interface Receipt {
  job: JobRecord;
  payment: Payment;
  /** The worker confirmed the money came; until then it is the owner's own word that they paid. */
  confirmed: boolean;
  /** When it was confirmed, else when the owner said they paid. */
  at: Date;
}

const S = PaymentStatus.enum;
/** A payment is a receipt once the owner said they paid it; requested or disputed ones are not. */
const PAID: ReadonlySet<PaymentStatus> = new Set([S.paid, S.confirmed]);

const paidAt = (p: Payment) => new Date(p.confirmed_at ?? p.paid_at ?? p.requested_at ?? 0);

/**
 * What the owner paid, newest first: every payment from `me` that they said they paid or the worker confirmed, with
 * its job. A payment whose job is not on this phone is left out: there is nothing to show it with.
 */
export function receiptsOf(jobs: readonly JobRecord[], payments: readonly Payment[], me: UserId): Receipt[] {
  const byId = new Map<EngagementId, JobRecord>(jobs.map((j) => [j.engagement.id, j]));
  const out: Receipt[] = [];
  for (const payment of payments) {
    const job = byId.get(payment.engagement);
    if (!job || payment.payer !== me || !PAID.has(payment.status)) continue;
    out.push({ job, payment, confirmed: payment.status === S.confirmed, at: paidAt(payment) });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime() || b.payment.id.localeCompare(a.payment.id));
}

/** All the owner paid across `receipts`, in paise. */
export const paidTotal = (receipts: readonly Receipt[]): number =>
  receipts.reduce((sum, r) => sum + r.payment.amount_paise, 0);
