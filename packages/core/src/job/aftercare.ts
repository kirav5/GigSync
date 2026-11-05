import {
  EnvelopeKind,
  type JobReview,
  type Note,
  PART_PAYMENTS_PROTOCOL,
  PAYMENT_NOTE_MAX,
  type Payee,
  type Payment,
  PaymentMethod,
  PaymentRecord,
  PaymentRequest,
  PaymentStatus,
  type UpdateCode,
} from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { log } from "../log.js";
import { OPEN_PAYMENT, PaymentError } from "../payments/book.js";
import { advanceCap, askableNow, balanceDue, canAskAdvance } from "../payments/passbook.js";
import { loadPayee, PayeeMissingError } from "../payments/payee.js";
import { buildUpiUri } from "../payments/upi.js";
import { Collection } from "../ports.js";
import type { JobContext } from "./context.js";
import { withNote } from "./history.js";
import { type JobRecord, TaskKind } from "./store.js";
import { recurs } from "./when.js";

const K = EnvelopeKind.enum;
const S = PaymentStatus.enum;

const NO_TERMS = "the job has no signed terms";

export class AftercareError extends Error {}

/** What a worker says in a note: one of the common codes, or their own words. */
export type Say = string | { code: UpdateCode };

/** The note as it travels: a code goes with the sender's wording of it, free text with its language. */
function noteOf(ctx: JobContext, say: Say): Note {
  if (typeof say === "string") return { text: say, lang: ctx.lang };
  return { text: t(ctx.lang, `update.${say.code}`), lang: ctx.lang, code: say.code };
}

/** Sends a note and keeps it on this phone too, stamped, so the worker sees what they said and when. */
async function sendNote(ctx: JobContext, r: JobRecord, kind: EnvelopeKind, say: Say): Promise<JobRecord> {
  const note = noteOf(ctx, say);
  const sent = await ctx.send(r, kind, note);
  const kept = withNote(sent, note, ctx.clock.now().toISOString(), true);
  await ctx.store.saveJob(kept);
  return kept;
}

/** Worker: on my way, or any progress note. */
export function sendUpdate(ctx: JobContext, r: JobRecord, say: Say): Promise<JobRecord> {
  return sendNote(ctx, r, K.update, say);
}

/** Worker: the work is done. */
export function sendDelivery(ctx: JobContext, r: JobRecord, say: Say): Promise<JobRecord> {
  return sendNote(ctx, r, K.delivery, say);
}

/** The worker's saved UPI ID and name, read at the moment it is needed; none saved stops the step before it starts. */
async function payeeOf(ctx: JobContext): Promise<Payee> {
  const payee = await loadPayee(ctx.storage);
  if (!payee) throw new PayeeMissingError("no UPI ID saved on this phone");
  return payee;
}

/** The amount to ask for now: the whole price on recurring work, what is left of it on a job that is done. */
function amountDue(r: JobRecord, price: number, payments: readonly Payment[]): number {
  if (!askableNow(r)) throw new AftercareError("the work is not done yet");
  const amount = recurs(r.request) ? price : balanceDue(r, payments);
  if (amount === 0) throw new AftercareError("nothing is left to ask for on this job");
  return amount;
}

/** Saves the ask, and sends it sealed with the UPI ID, which is read from settings and not kept in the payment. */
async function ask(ctx: JobContext, r: JobRecord, amountPaise: number, note: string, advance?: true): Promise<Payment> {
  const payee = await payeeOf(ctx);
  const payment = await ctx.payments.request({
    engagement: r.engagement,
    payee: ctx.me.user,
    amountPaise,
    // The payer's UPI app shows only a short note.
    note: note.slice(0, PAYMENT_NOTE_MAX),
    ...(advance ? { advance } : {}),
  });
  const body = PaymentRequest.parse({
    id: payment.id,
    engagement: payment.engagement,
    payee: payment.payee,
    payer: payment.payer,
    amount_paise: payment.amount_paise,
    note: payment.note,
    payee_vpa: payee.vpa,
    payee_name: payee.name,
    requested_at: payment.requested_at,
    ...(advance ? { advance } : {}),
  });
  await ctx.send(r, K.payment_request, body);
  return payment;
}

/**
 * Worker: ask to be paid, once the work is done (ADR 0054), or by the period on recurring work. Nothing is saved when
 * the UPI ID is missing or a payment is already open on the job.
 */
export async function requestPayment(ctx: JobContext, r: JobRecord, note: string): Promise<Payment> {
  const terms = r.mine?.terms;
  if (!terms) throw new AftercareError(NO_TERMS);
  const payments = await ctx.payments.forEngagement(r.engagement.id);
  if (payments.some((p) => OPEN_PAYMENT.has(p.status)))
    throw new AftercareError("a payment is already open on this job");
  return ask(ctx, r, amountDue(r, terms.price_paise, payments), note);
}

/** The other phone takes part of the price: only then can a worker ask for an advance. */
export const takesAdvance = (ctx: JobContext, r: JobRecord): Promise<boolean> =>
  ctx.speaks(r.engagement.counterpart, PART_PAYMENTS_PROTOCOL);

/** Worker: ask for part of the price before the work is done (ADR 0054), at most `advanceCap`, once a job. */
export async function requestAdvance(
  ctx: JobContext,
  r: JobRecord,
  amountPaise: number,
  note: string,
): Promise<Payment> {
  if (!r.mine) throw new AftercareError(NO_TERMS);
  if (!canAskAdvance(r, await ctx.payments.forEngagement(r.engagement.id)))
    throw new AftercareError("an advance cannot be asked for on this job");
  if (amountPaise > advanceCap(r)) throw new AftercareError("the advance is over the limit");
  if (!(await takesAdvance(ctx, r))) throw new AftercareError("the other phone does not take an advance");
  return ask(ctx, r, amountPaise, note, true);
}

/**
 * Worker: the customer paid in cash. An open payment becomes cash and is confirmed; with none open, a cash payment for
 * the amount due is asked for and confirmed at once. Each change goes to the other phone as its own record, in
 * order, because the other phone takes a new payment only as a request.
 */
export async function recordCash(ctx: JobContext, r: JobRecord): Promise<Payment> {
  const terms = r.mine?.terms;
  if (!terms) throw new AftercareError(NO_TERMS);
  const payments = await ctx.payments.forEngagement(r.engagement.id);
  const open = payments.find((p) => OPEN_PAYMENT.has(p.status));
  if (open) {
    const cash = await ctx.payments.confirmCash(open.id);
    await ctx.store.removeTask(TaskKind.confirmPayment, r.engagement.id);
    await sendPaymentRecord(ctx, r, cash);
    return cash;
  }
  const asked = await ctx.payments.request({
    engagement: r.engagement,
    payee: ctx.me.user,
    amountPaise: amountDue(r, terms.price_paise, payments),
    note: "",
    method: PaymentMethod.enum.cash,
  });
  const cash = await ctx.payments.confirmCash(asked.id);
  await sendPaymentRecord(ctx, r, asked);
  await sendPaymentRecord(ctx, r, cash);
  return cash;
}

/** Worker: the UPI link for their own QR on an open payment to them, from the payee saved in settings. */
export async function myUpiLink(ctx: JobContext, paymentId: string): Promise<string> {
  const payee = await payeeOf(ctx);
  const p = await ctx.payments.get(paymentId);
  if (!p || p.payee !== ctx.me.user || !OPEN_PAYMENT.has(p.status))
    throw new AftercareError(`no open payment ${paymentId} to this phone`);
  return buildUpiUri({ vpa: payee.vpa, name: payee.name, amountPaise: p.amount_paise, note: p.note, ref: p.id });
}

/** The amount a worker may ask: the signed price on recurring work, else an advance within its limit or what is left. */
function fairAsk(r: JobRecord, body: PaymentRequest, payments: readonly Payment[]): boolean {
  if (recurs(r.request)) return body.amount_paise === r.mine?.terms.price_paise;
  if (!body.advance) return body.amount_paise === balanceDue(r, payments);
  return canAskAdvance(r, payments) && body.amount_paise <= advanceCap(r);
}

/** Consumer: a payment request arrived for a signed job, for a fair amount. Keep it so the owner can pay. */
export async function onPaymentRequest(ctx: JobContext, r: JobRecord, body: PaymentRequest): Promise<void> {
  const payments = await ctx.payments.forEngagement(r.engagement.id);
  if (!fairAsk(r, body, payments) || body.payer !== ctx.me.user) {
    log.warn("payment request ignored", { engagement: r.engagement.id });
    return;
  }
  await ctx.storage.put(Collection.paymentRequests, body.id, body);
  await ctx.payments.receive(
    {
      id: body.id,
      engagement: body.engagement,
      payee: body.payee,
      payer: body.payer,
      amount_paise: body.amount_paise,
      method: PaymentMethod.enum.upi,
      status: S.requested,
      note: body.note,
      requested_at: body.requested_at,
      ...(body.advance ? { advance: body.advance } : {}),
    },
    r.engagement.counterpart,
  );
}

/** Consumer: the UPI link (and QR content) for a payment request. */
export async function upiLink(ctx: JobContext, paymentId: string): Promise<string> {
  const req = await ctx.storage.get<PaymentRequest>(Collection.paymentRequests, paymentId);
  if (!req) throw new AftercareError(`no payment request ${paymentId}`);
  return buildUpiUri({
    vpa: req.payee_vpa,
    name: req.payee_name,
    amountPaise: req.amount_paise,
    note: req.note,
    ref: req.id,
  });
}

/** Either side: tell the other about a change to a payment. */
export function sendPaymentRecord(ctx: JobContext, r: JobRecord, payment: Payment): Promise<JobRecord> {
  return ctx.send(r, K.payment_record, PaymentRecord.parse({ payment }));
}

/**
 * Either side: the other side changed a payment. The worker gets a task to confirm money the consumer says they sent.
 * A payment this phone has never seen is taken only for this phone to pay, at the signed price: otherwise the other
 * side could put any amount on the record.
 */
export async function onPaymentRecord(ctx: JobContext, r: JobRecord, body: PaymentRecord): Promise<void> {
  if (body.payment.engagement !== r.engagement.id) return;
  const known = await ctx.payments.get(body.payment.id);
  if (!known && (body.payment.payer !== ctx.me.user || body.payment.amount_paise !== r.mine?.terms.price_paise)) {
    log.warn("payment record ignored", { engagement: r.engagement.id, reason: "unknown payment off the signed price" });
    return;
  }
  let ours: Payment;
  try {
    ours = await ctx.payments.receive(body.payment, r.engagement.counterpart);
  } catch (err) {
    if (!(err instanceof PaymentError)) throw err;
    log.warn("payment record ignored", { engagement: r.engagement.id, reason: err.message });
    return;
  }
  if (ours.status === S.paid && ours.payee === ctx.me.user)
    await ctx.store.addTask(TaskKind.confirmPayment, r.engagement.id, ours, ctx.clock.now());
}

/** Consumer: rate the job once it is delivered. */
export function sendReview(ctx: JobContext, r: JobRecord, review: JobReview): Promise<JobRecord> {
  return ctx.send({ ...r, review }, K.review, review);
}
