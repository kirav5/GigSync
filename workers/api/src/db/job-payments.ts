import type { EngagementId, ExportedPayment, PaymentId, PaymentMethod, PaymentReport } from "@gigsync/protocol";
import type { Side } from "../records/sides.js";
import type { Db } from "./client.js";

interface PaymentRow {
  payment_id: PaymentId;
  engagement_id: EngagementId;
  amount_paise: number;
  paid_on: string;
  method: PaymentMethod;
  confirmed: boolean;
}

/** Days as "YYYY-MM-DD" text: pg would parse a DATE in the local zone. */
const COLUMNS = `payment_id, engagement_id, amount_paise, to_char(paid_on, 'YYYY-MM-DD') AS paid_on, method,
  confirmed_at IS NOT NULL AS confirmed`;

const exported = (r: PaymentRow): ExportedPayment => ({
  payment: r.payment_id,
  amount_paise: r.amount_paise,
  paid_on: r.paid_on,
  method: r.method,
  confirmed: r.confirmed,
});

/** A payment as stored, with the job it belongs to. */
export interface StoredPayment {
  engagement: EngagementId;
  payment: ExportedPayment;
}

/** One payment by id, or undefined. */
export async function paymentOf(db: Db, id: PaymentId): Promise<StoredPayment | undefined> {
  const { rows } = await db.query<PaymentRow>(`SELECT ${COLUMNS} FROM job_payments WHERE payment_id = $1`, [id]);
  const [r] = rows;
  return r && { engagement: r.engagement_id, payment: exported(r) };
}

/**
 * Records a payment reported by `side`; confirmed at once when the worker reports receiving it. Undefined when the id is
 * already taken (the caller compares with what is stored).
 */
export async function addPayment(
  db: Db,
  engagement: EngagementId,
  p: PaymentReport,
  side: Side,
  confirmedNow: boolean,
  at: Date,
): Promise<ExportedPayment | undefined> {
  const { rows } = await db.query<PaymentRow>(
    `INSERT INTO job_payments (payment_id, engagement_id, amount_paise, paid_on, method, reported_by, reported_at,
       confirmed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN $7::timestamptz END)
     ON CONFLICT (payment_id) DO NOTHING
     RETURNING ${COLUMNS}`,
    [p.payment, engagement, p.amount_paise, p.paid_on, p.method, side, at, confirmedNow],
  );
  const [r] = rows;
  return r && exported(r);
}

/** The worker confirms receiving a payment; confirming twice keeps the first time. */
export async function confirmPayment(db: Db, id: PaymentId, at: Date): Promise<ExportedPayment | undefined> {
  const { rows } = await db.query<PaymentRow>(
    `UPDATE job_payments SET confirmed_at = COALESCE(confirmed_at, $2) WHERE payment_id = $1 RETURNING ${COLUMNS}`,
    [id, at],
  );
  const [r] = rows;
  return r && exported(r);
}

/** Every payment of these jobs, by job, oldest day first. */
export async function paymentsFor(
  db: Db,
  engagements: readonly EngagementId[],
): Promise<Map<EngagementId, ExportedPayment[]>> {
  const out = new Map<EngagementId, ExportedPayment[]>();
  if (engagements.length === 0) return out;
  const { rows } = await db.query<PaymentRow>(
    `SELECT ${COLUMNS} FROM job_payments WHERE engagement_id = ANY($1) ORDER BY paid_on, payment_id`,
    [engagements],
  );
  for (const r of rows) out.set(r.engagement_id, [...(out.get(r.engagement_id) ?? []), exported(r)]);
  return out;
}
