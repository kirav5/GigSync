import {
  EnvelopeKind,
  type JobReview,
  type Note,
  type Payment,
  PaymentMethod,
  PaymentRecord,
  type PaymentRequest,
  PaymentStatus,
  type UpdateCode,
} from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { log } from "../log.js";
import { PaymentError } from "../payments/book.js";
import { buildUpiUri } from "../payments/upi.js";
import { Collection } from "../ports.js";
import type { JobContext } from "./context.js";
import { type JobRecord, TaskKind } from "./store.js";
import type { WorkerRules } from "./worker.js";

const K = EnvelopeKind.enum;
const S = PaymentStatus.enum;

export class AftercareError extends Error {}

/** What a worker says in a note: one of the common codes, or their own words. */
export type Say = string | { code: UpdateCode };

/** The note as it travels: a code goes with the sender's wording of it, free text with its language. */
function noteOf(ctx: JobContext, say: Say): Note {
  if (typeof say === "string") return { text: say, lang: ctx.lang };
  return { text: t(ctx.lang, `update.${say.code}`), lang: ctx.lang, code: say.code };
}

/** Worker: on my way, or any progress note. */
export function sendUpdate(ctx: JobContext, r: JobRecord, say: Say): Promise<JobRecord> {
  return ctx.send(r, K.update, noteOf(ctx, say));
}

/** Worker: the work is done. */
export function sendDelivery(ctx: JobContext, r: JobRecord, say: Say): Promise<JobRecord> {
  return ctx.send(r, K.delivery, noteOf(ctx, say));
}

/** Worker: ask for the agreed price. The UPI ID travels sealed to the consumer and is not kept in the payment. */
export async function requestPayment(
  ctx: JobContext,
  rules: WorkerRules,
  r: JobRecord,
  note: string,
): Promise<Payment> {
  const terms = r.mine?.terms;
  if (!terms) throw new AftercareError("the job has no signed terms");
  const payment = await ctx.payments.request({
    engagement: r.engagement,
    payee: ctx.me.user,
    amountPaise: terms.price_paise,
    note,
  });
  const body: PaymentRequest = {
    id: payment.id,
    engagement: payment.engagement,
    payee: payment.payee,
    payer: payment.payer,
    amount_paise: payment.amount_paise,
    note: payment.note,
    payee_vpa: rules.vpa,
    payee_name: rules.payee_name,
    requested_at: payment.requested_at as string,
  };
  await ctx.send(r, K.payment_request, body);
  return payment;
}

/** Consumer: a payment request arrived for a signed job, for the signed amount. Keep it so the owner can pay. */
export async function onPaymentRequest(ctx: JobContext, r: JobRecord, body: PaymentRequest): Promise<void> {
  if (body.amount_paise !== r.mine?.terms.price_paise || body.payer !== ctx.me.user) {
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

/** Either side: the other side changed a payment. The worker gets a task to confirm money the consumer says they sent. */
export async function onPaymentRecord(ctx: JobContext, r: JobRecord, body: PaymentRecord): Promise<void> {
  if (body.payment.engagement !== r.engagement.id) return;
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
