import { z } from "zod";
import { Role } from "./engagement.js";
import { EngagementId, UserId } from "./ids.js";
import { JobQuantities } from "./job-quantities.js";
import { JobRecordStatus, JobTermsFields, JobWork, PaymentReport } from "./job-record.js";
import { Paise } from "./payment.js";
import { MAX_STARS, MIN_STARS } from "./worker-record.js";

/**
 * What leaves the server about job records (ADR 0038 §3–5): a person's own export, the result of deleting their
 * records, and the admin-only earnings aggregate. Never free text, contact details or another person's details beyond
 * their user id (null once that person deleted their records).
 */

export const DEFAULT_EXPORT_PAGE = 100;
export const MAX_EXPORT_PAGE = 200;

/** `GET /v1/jobs/records/mine?after=&limit=`: oldest first, paged by engagement id. */
export const RecordsPage = z.object({
  after: EngagementId.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_EXPORT_PAGE).default(DEFAULT_EXPORT_PAGE),
});
export type RecordsPage = z.infer<typeof RecordsPage>;
export type RecordsPageInput = z.input<typeof RecordsPage>;

/** One payment as exported: as reported, and whether the worker confirmed receiving it (only confirmed ones count). */
export const ExportedPayment = PaymentReport.extend({ confirmed: z.boolean() });
export type ExportedPayment = z.infer<typeof ExportedPayment>;

const isoDate = z.iso.datetime({ offset: true });

/** One job in the export, from the caller's side: their role and the other party (null once they deleted theirs). */
export const ExportedJob = z.object({
  engagement: EngagementId,
  role: Role,
  counterpart: UserId.nullable(),
  work: JobWork,
  /** The job's quantities (ADR 0041 §4), when a phone sent them. */
  quantities: JobQuantities.optional(),
  terms: JobTermsFields,
  price_paise: Paise,
  status: JobRecordStatus,
  /** True once both sides matched; false for a one-sided job (only the worker's side reached the server). */
  attested: z.boolean(),
  /** When the job was stored: the worker's submission for a one-sided job, else the matching second one. */
  agreed_at: isoDate,
  done_at: isoDate.optional(),
  cancelled_at: isoDate.optional(),
  stars: z.number().int().min(MIN_STARS).max(MAX_STARS).optional(),
  payments: z.array(ExportedPayment),
});
export type ExportedJob = z.infer<typeof ExportedJob>;

/** "My work record": a page of the caller's stored jobs, and the cursor for the next page when there is one. */
export const MyJobRecords = z.object({ jobs: z.array(ExportedJob), next: EngagementId.optional() });
export type MyJobRecords = z.infer<typeof MyJobRecords>;

/**
 * `DELETE /v1/me/records`: what went. A worker's jobs are deleted with their payments; a household's jobs stay on the
 * worker's record without the household's id; pending and set-aside submissions involving the person are deleted; the
 * consent is withdrawn, so new records need the notice accepted again.
 */
export const RecordsDeleted = z.object({
  deleted: z.number().int().nonnegative(),
  anonymised: z.number().int().nonnegative(),
  submissions: z.number().int().nonnegative(),
});
export type RecordsDeleted = z.infer<typeof RecordsDeleted>;

/** A calendar month, "YYYY-MM". */
export const IsoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM");
/** The widest span one analytics query covers, in months. */
export const MAX_ANALYTICS_MONTHS = 24;
export const MAX_ANALYTICS_ROWS = 5000;

/** Admin only, `GET /v1/admin/analytics/earnings?from=&to=`: months inclusive. */
const MONTHS_PER_YEAR = 12;
const monthIndex = (m: string) => Number(m.slice(0, 4)) * MONTHS_PER_YEAR + Number(m.slice(5, 7));
export const EarningsQuery = z
  .object({ from: IsoMonth, to: IsoMonth })
  .refine((q) => q.from <= q.to, "from after to")
  .refine((q) => monthIndex(q.to) - monthIndex(q.from) < MAX_ANALYTICS_MONTHS, "too many months");
export type EarningsQuery = z.infer<typeof EarningsQuery>;

/**
 * Per worker per month: jobs not cancelled, by the agreed day or else the day the job was stored, and confirmed payments
 * by the day paid. `jobs` counts both kinds; `one_sided` says how many of them only the worker attested. A month with
 * neither jobs nor payments has no row.
 */
export const EarningsRow = z.object({
  worker: UserId,
  month: IsoMonth,
  jobs: z.number().int().nonnegative(),
  one_sided: z.number().int().nonnegative(),
  revenue_paise: z.number().int().nonnegative(),
});
export type EarningsRow = z.infer<typeof EarningsRow>;
export const EarningsReport = z.object({ rows: z.array(EarningsRow) });
export type EarningsReport = z.infer<typeof EarningsReport>;
