import { PAISE_PER_RUPEE, PAYEE_NAME_MAX, PAYMENT_NOTE_MAX, Paise, Vpa } from "@gigsync/protocol";

/** The UPI deep-link scheme every UPI app registers (NPCI "UPI Linking Specification"). */
export const UPI_SCHEME = "upi://pay";
export const UPI_CURRENCY = "INR";
/** Longest transaction reference we put in `tr`; apps truncate or reject longer ones. */
export const UPI_REF_MAX = 35;

/** NPCI's query keys, so the link is never assembled from bare strings. */
export const UpiParam = {
  payee: "pa",
  name: "pn",
  amount: "am",
  currency: "cu",
  note: "tn",
  ref: "tr",
} as const;

export class UpiError extends Error {}

export interface UpiPayment {
  /** The worker's own UPI ID, in the form name@bank. */
  vpa: string;
  /** Shown to the payer by their UPI app. */
  name: string;
  amountPaise: number;
  /** Short free text the payer sees, e.g. "Cleaning, 3 visits". */
  note: string;
  /** Our reference, so the payment can be matched to the job later: the payment id. */
  ref: string;
}

/** 45000 → "450.00": UPI wants rupees with exactly two decimals. */
export function rupees(paise: number): string {
  const whole = Math.trunc(paise / PAISE_PER_RUPEE);
  const rest = String(paise % PAISE_PER_RUPEE).padStart(2, "0");
  return `${whole}.${rest}`;
}

const clean = (text: string, max: number) =>
  text
    .replace(/[^\p{L}\p{M}\p{N} ,.\-_/]/gu, "")
    .trim()
    .slice(0, max);

/**
 * The UPI link for one payment, which is also the QR code's content. Validates the UPI ID and amount, and strips
 * characters UPI apps reject from the name and note.
 */
export function buildUpiUri(p: UpiPayment): string {
  if (!Vpa.safeParse(p.vpa).success) throw new UpiError("not a valid UPI ID");
  if (!Paise.safeParse(p.amountPaise).success) throw new UpiError("amount must be whole paise within the UPI limit");
  const name = clean(p.name, PAYEE_NAME_MAX);
  if (!name) throw new UpiError("payee name is empty");
  const params = new URLSearchParams();
  params.set(UpiParam.payee, p.vpa);
  params.set(UpiParam.name, name);
  params.set(UpiParam.amount, rupees(p.amountPaise));
  params.set(UpiParam.currency, UPI_CURRENCY);
  const note = clean(p.note, PAYMENT_NOTE_MAX);
  if (note) params.set(UpiParam.note, note);
  params.set(UpiParam.ref, clean(p.ref, UPI_REF_MAX));
  // URLSearchParams writes spaces as "+", which some UPI apps show literally, and "@" as "%40", which some apps do not
  // decode in the payee address. NPCI's examples use %20 and a literal "@".
  return `${UPI_SCHEME}?${params.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}
