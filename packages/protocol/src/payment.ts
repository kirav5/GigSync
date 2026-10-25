import { z } from "zod";
import { EngagementId, PaymentId, UserId } from "./ids.js";

/**
 * Payments for a job (ADR 0011). A job is an engagement: the consumer is the requester and pays, the gig worker is
 * the provider and is paid straight into their own UPI account. GigSync never holds or moves the money; these records
 * are what both phones keep about it.
 */

/** NPCI's per-transaction cap for an ordinary UPI payment: ₹1,00,000, in paise. */
export const UPI_MAX_PAISE = 1_00_000 * 100;
export const PAISE_PER_RUPEE = 100;
export const PAYMENT_NOTE_MAX = 50;
export const PAYEE_NAME_MAX = 40;

/** A UPI ID (virtual payment address), in the form name@bank. */
export const Vpa = z.string().regex(/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/, "UPI ID");
export type Vpa = z.infer<typeof Vpa>;

/** Money is always integer paise, never a float of rupees. */
export const Paise = z.number().int().positive().max(UPI_MAX_PAISE);

/** The 12-digit UPI transaction reference (UTR / RRN) the payer's app shows after paying. */
export const Utr = z.string().regex(/^\d{12}$/, "12-digit UPI reference");

export const PaymentMethod = z.enum(["upi", "cash"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** requested → paid → confirmed, or disputed. Only the worker confirms or disputes. */
export const PaymentStatus = z.enum(["requested", "paid", "confirmed", "disputed"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

const isoDate = z.string().datetime({ offset: true });
const note = z.string().max(PAYMENT_NOTE_MAX);

/** Body of a `payment_request` envelope: what the consumer's app needs to show the QR or open a UPI app. */
export const PaymentRequest = z.object({
  id: PaymentId,
  engagement: EngagementId,
  payee: UserId,
  payer: UserId,
  amount_paise: Paise,
  note,
  payee_vpa: Vpa,
  payee_name: z.string().min(1).max(PAYEE_NAME_MAX),
  requested_at: isoDate,
});
export type PaymentRequest = z.infer<typeof PaymentRequest>;

/** One payment for one job, as each phone keeps it. Never holds the worker's UPI ID. */
export const Payment = z.object({
  id: PaymentId,
  engagement: EngagementId,
  payee: UserId,
  payer: UserId,
  amount_paise: Paise,
  method: PaymentMethod,
  status: PaymentStatus,
  note,
  utr: Utr.optional(),
  requested_at: isoDate.optional(),
  paid_at: isoDate.optional(),
  confirmed_at: isoDate.optional(),
  disputed_at: isoDate.optional(),
});
export type Payment = z.infer<typeof Payment>;

/** Body of a `payment_record` envelope: the sender's view of a payment after a change. */
export const PaymentRecord = z.object({ payment: Payment });
export type PaymentRecord = z.infer<typeof PaymentRecord>;
