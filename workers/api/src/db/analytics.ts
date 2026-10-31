import { type EarningsQuery, type EarningsRow, MAX_ANALYTICS_ROWS } from "@gigsync/protocol";
import { CANCELLED } from "../records/sides.js";
import type { Db } from "./client.js";

/** Jobs are dated in India's time when no day was agreed: a job stored at 00:30 IST belongs to that day. */
const JOB_TIME_ZONE = "Asia/Kolkata";
const MONTH_FORMAT = "YYYY-MM";

/** A month's first day, as SQL reads a date. */
const firstDay = (month: string) => `${month}-01`;

/**
 * Admin only (ADR 0038 §3): per worker per month, stored jobs not cancelled, attested or one-sided, with how many were
 * one-sided (dated by the agreed day, else the day the job was stored), and confirmed payments (by the day paid).
 * Aggregates only: never a household, never a job's fields.
 */
export async function monthlyEarnings(db: Db, q: EarningsQuery): Promise<EarningsRow[]> {
  const { rows } = await db.query<EarningsRow>(
    `WITH span AS (SELECT $1::date AS first, ($2::date + interval '1 month')::date AS after),
     jobs AS (
       SELECT j.worker_id, to_char(d.day, $5) AS month, count(*)::int AS jobs,
         (count(*) FILTER (WHERE NOT j.attested))::int AS one_sided
       FROM job_records j CROSS JOIN span
       CROSS JOIN LATERAL (SELECT COALESCE(j.work_day, (j.agreed_at AT TIME ZONE $4)::date) AS day) d
       WHERE j.status <> '${CANCELLED}' AND d.day >= span.first AND d.day < span.after
       GROUP BY 1, 2),
     revenue AS (
       SELECT j.worker_id, to_char(p.paid_on, $5) AS month, sum(p.amount_paise)::int AS revenue_paise
       FROM job_payments p JOIN job_records j ON j.engagement_id = p.engagement_id CROSS JOIN span
       WHERE p.confirmed_at IS NOT NULL AND p.paid_on >= span.first AND p.paid_on < span.after
       GROUP BY 1, 2)
     SELECT COALESCE(j.worker_id, v.worker_id) AS worker, COALESCE(j.month, v.month) AS month,
       COALESCE(j.jobs, 0) AS jobs, COALESCE(j.one_sided, 0) AS one_sided, COALESCE(v.revenue_paise, 0) AS revenue_paise
     FROM jobs j FULL JOIN revenue v ON v.worker_id = j.worker_id AND v.month = j.month
     ORDER BY worker, month
     LIMIT $3`,
    [firstDay(q.from), firstDay(q.to), MAX_ANALYTICS_ROWS, JOB_TIME_ZONE, MONTH_FORMAT],
  );
  return rows;
}
