import {
  EngagementStatus,
  JobRecordStatus,
  type JobRecordSubmit,
  type JobStatusChange,
  JobTermsFields,
  JobWork,
  type Payment,
  type PaymentReport,
  PaymentStatus,
  QuestionKey,
  Role,
  SKIPPED,
} from "@gigsync/protocol";
import { tradeScope } from "../estimate/scope.js";
import type { JobRecord } from "../job/store.js";
import { termDetails } from "../job/terms-flow.js";
import { localDay } from "../job/when.js";
import { FINISHED_WORK, type SignedJob } from "../payments/passbook.js";

/**
 * The facts of a job GigSync keeps (ADR 0038 §1), picked field by field from what the phone holds. Nothing is copied
 * wholesale: the scope is the trade's buckets (ADR 0030's, filled only from toggles, counts and fixed choices), the
 * terms are the structured ones both signed, and the protocol's strict schemas refuse any other key. No words a person
 * typed (the need, the scope or slot of the terms, a note, an answer, a review, an address) can reach the server.
 */

/**
 * The details both phones hold alike: the request's own, and the answers to standard questions (the worker's phone
 * folds those into its request; the household's keeps them beside it).
 */
function sharedDetails(r: JobRecord): Record<string, string> {
  const answers = Object.entries(r.answers ?? {}).filter(
    ([key, text]) => QuestionKey.safeParse(key).success && text !== SKIPPED,
  );
  return { ...r.request.details, ...Object.fromEntries(answers) };
}

/**
 * The job's trade and scope, with what the signed terms decide (who buys the paint, hours a day) taken from them, since
 * either agent may have moved those details while bargaining. Undefined if it fails the schema (a bug if seen).
 */
export function jobWork(job: SignedJob): JobWork | undefined {
  const { trade, terms } = job.mine.terms;
  const details = { ...sharedDetails(job), ...termDetails(trade, terms) };
  return JobWork.safeParse({ trade, scope: tradeScope(trade, details) }).data;
}

/** What this phone submits about a job both signed: the same fields from either side, with its own signature. */
export function submissionOf(job: SignedJob): JobRecordSubmit | undefined {
  const signed = job.mine.terms;
  const work = jobWork(job);
  const terms = JobTermsFields.safeParse(signed.terms ?? {}).data;
  if (!work || !terms) return undefined;
  return {
    engagement: job.engagement.id,
    counterpart: job.engagement.counterpart,
    role: job.engagement.role,
    work,
    terms,
    price_paise: signed.price_paise,
    terms_hash: job.mine.terms_hash,
    sig: job.mine.sig,
  };
}

/** Where a signed job ended, or undefined while it is still under way. */
export function outcomeOf(job: SignedJob): JobStatusChange | undefined {
  if (FINISHED_WORK.has(job.engagement.status)) return { status: JobRecordStatus.enum.done };
  if (job.engagement.status === EngagementStatus.enum.cancelled) return { status: JobRecordStatus.enum.cancelled };
  return undefined;
}

/**
 * The worker's record of a payment they confirmed receiving: amount, day and how, never the UPI reference. The worker
 * is the payee, so GigSync counts their report at once; a household's would wait for the worker anyway.
 */
export function paymentOf(job: SignedJob, payment: Payment): PaymentReport | undefined {
  const at = payment.confirmed_at ?? payment.paid_at;
  if (job.engagement.role !== Role.enum.provider || payment.status !== PaymentStatus.enum.confirmed || !at)
    return undefined;
  const when = new Date(at);
  return {
    payment: payment.id,
    amount_paise: payment.amount_paise,
    method: payment.method,
    // The day where the worker's phone is, as their passbook files it.
    paid_on: localDay(when, -when.getTimezoneOffset()),
  };
}
