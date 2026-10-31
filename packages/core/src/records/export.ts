import { type ExportedJob, MAX_EXPORT_PAGE, type PaymentMethod, Role } from "@gigsync/protocol";
import { localDay } from "../job/when.js";
import type { RecordsApi } from "./types.js";

/**
 * "My work record" (ADR 0038 §4): every job GigSync keeps for this worker, pulled from the server on whichever phone
 * she signed in to, with the totals she would show anyone.
 */

/** Pages read at most: 50 pages of 200 jobs is more than any worker's years of work. */
const MAX_PAGES = 50;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Oldest agreed first, as a work record reads. */
export const byAgreed = (a: ExportedJob, b: ExportedJob): number => a.agreed_at.localeCompare(b.agreed_at);

/** Every job the server keeps for this owner, on either side, oldest first. */
export async function allMyRecords(api: Pick<RecordsApi, "myJobRecords">): Promise<ExportedJob[]> {
  const jobs: ExportedJob[] = [];
  let after: ExportedJob["engagement"] | undefined;
  // One page after another: each needs the cursor the last one ended on.
  for (let page = 0; page < MAX_PAGES; page++) {
    const got = await api.myJobRecords({ limit: MAX_EXPORT_PAGE, ...(after ? { after } : {}) });
    jobs.push(...got.jobs);
    if (!got.next) break;
    after = got.next;
  }
  return jobs.sort(byAgreed);
}

/** The worker's jobs as the server keeps them, oldest first; only those where she was the worker. */
export async function myWorkRecord(api: Pick<RecordsApi, "myJobRecords">): Promise<ExportedJob[]> {
  return (await allMyRecords(api)).filter((j) => j.role === Role.enum.provider);
}

/** The day the job was for, or the day it was agreed (where this phone is) when it had no single day (daily work). */
export const jobDay = (job: ExportedJob): string => {
  const day = job.terms.when?.day;
  if (day && ISO_DAY.test(day)) return day;
  const agreed = new Date(job.agreed_at);
  return localDay(agreed, -agreed.getTimezoneOffset());
};

/** Money the household confirmed paying for a job. */
export const paidFor = (job: ExportedJob): number =>
  job.payments.filter((p) => p.confirmed).reduce((sum, p) => sum + p.amount_paise, 0);

/** How a job was paid: each method once, in the order paid. */
export const methodsOf = (job: ExportedJob): PaymentMethod[] => [
  ...new Set(job.payments.filter((p) => p.confirmed).map((p) => p.method)),
];

export interface WorkTotals {
  jobs: number;
  earned_paise: number;
  rated: number;
}

export function workTotals(jobs: readonly ExportedJob[]): WorkTotals {
  return {
    jobs: jobs.length,
    earned_paise: jobs.reduce((sum, j) => sum + paidFor(j), 0),
    rated: jobs.filter((j) => j.stars !== undefined).length,
  };
}
