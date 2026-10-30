import {
  canonicalJson,
  type EngagementId,
  type JobRecordSubmit,
  type JobStatusChange,
  type Payment,
  type PaymentReport,
  Role,
  type StarsReport,
} from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { bothSigned } from "../payments/passbook.js";
import { outcomeOf, paymentOf, submissionOf } from "./facts.js";

/** What kind of fact a report carries, in the order the server needs them: the job first, then what follows it. */
export const ReportKind = { job: "job", status: "status", payment: "payment", stars: "stars" } as const;
export type ReportKind = (typeof ReportKind)[keyof typeof ReportKind];

/** One fact due for the server, with an id that stays the same when its content changes (a later one replaces it). */
export type RecordReport = { id: string; engagement: EngagementId } & (
  | { kind: typeof ReportKind.job; body: JobRecordSubmit }
  | { kind: typeof ReportKind.status; body: JobStatusChange }
  | { kind: typeof ReportKind.payment; body: PaymentReport }
  | { kind: typeof ReportKind.stars; body: StarsReport }
);

const ID_SEP = ":";
const reportId = (...parts: string[]) => parts.join(ID_SEP);

/** The content of a report as compared with what the server accepted: the same facts give the same text. */
export const fingerprint = (report: RecordReport): string => canonicalJson(report.body);

/**
 * Every fact this phone owes the server about its jobs, as it holds them now (ADR 0038 §2): for each job both signed,
 * its submission (either side), how it ended (either side), the payments the worker confirmed (worker's side) and the
 * household's stars (household's side). Pure: what was already accepted is left out by the caller.
 */
export function recordsDue(jobs: readonly JobRecord[], payments: readonly Payment[]): RecordReport[] {
  const due: RecordReport[] = [];
  for (const job of jobs) {
    if (!bothSigned(job)) continue;
    const engagement = job.engagement.id;
    const submit = submissionOf(job);
    if (!submit) continue;
    due.push({ id: reportId(ReportKind.job, engagement), engagement, kind: ReportKind.job, body: submit });
    const outcome = outcomeOf(job);
    if (outcome)
      due.push({ id: reportId(ReportKind.status, engagement), engagement, kind: ReportKind.status, body: outcome });
    for (const p of payments) {
      const body = p.engagement === engagement ? paymentOf(job, p) : undefined;
      if (body) due.push({ id: reportId(ReportKind.payment, p.id), engagement, kind: ReportKind.payment, body });
    }
    if (job.review && job.engagement.role === Role.enum.requester)
      due.push({
        id: reportId(ReportKind.stars, engagement),
        engagement,
        kind: ReportKind.stars,
        body: { stars: job.review.stars },
      });
  }
  return due;
}
