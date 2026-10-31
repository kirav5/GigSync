import type { EngagementId, JobRecordStatus, RecordsPage, UserId } from "@gigsync/protocol";
import type { JobColumns, JobFields } from "../records/fields.js";
import { AGREED, DONE, Side } from "../records/sides.js";
import type { Db } from "./client.js";
import type { QuantityColumns } from "./record-quantities.js";

/**
 * Stores a job as agreed: attested by both sides, or one-sided (the worker's side only). Over the same worker's
 * one-sided job it replaces the fields (her correction, or the household's match making it attested) and keeps the
 * status, payments and stars. False when the engagement holds an attested job or another worker's: nothing changed.
 */
export async function upsertRecord(db: Db, f: JobFields, c: JobColumns, attested: boolean, at: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO job_records (engagement_id, worker_id, household_id, trade, scope_problem, scope_rooms,
       scope_frequency, scope_people, scope_meals, scope_hours_band, scope_labour_only, work_day, work_daily,
       work_window, materials_by, coats, hours_per_day, price_paise, terms_hash, status, agreed_at, attested, area_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT (engagement_id) DO UPDATE SET household_id = excluded.household_id, trade = excluded.trade,
       scope_problem = excluded.scope_problem, scope_rooms = excluded.scope_rooms,
       scope_frequency = excluded.scope_frequency, scope_people = excluded.scope_people,
       scope_meals = excluded.scope_meals, scope_hours_band = excluded.scope_hours_band,
       scope_labour_only = excluded.scope_labour_only, work_day = excluded.work_day, work_daily = excluded.work_daily,
       work_window = excluded.work_window, materials_by = excluded.materials_by, coats = excluded.coats,
       hours_per_day = excluded.hours_per_day, price_paise = excluded.price_paise, terms_hash = excluded.terms_hash,
       attested = excluded.attested, area_key = excluded.area_key
     WHERE job_records.worker_id = excluded.worker_id AND NOT job_records.attested`,
    [
      f.engagement,
      f.worker,
      f.household,
      c.trade,
      c.scope_problem,
      c.scope_rooms,
      c.scope_frequency,
      c.scope_people,
      c.scope_meals,
      c.scope_hours_band,
      c.scope_labour_only,
      c.work_day,
      c.work_daily,
      c.work_window,
      c.materials_by,
      c.coats,
      c.hours_per_day,
      f.price_paise,
      f.terms_hash,
      AGREED,
      at,
      attested,
      f.area ?? null,
    ],
  );
  return (rowCount ?? 0) > 0;
}

/** Withdraws a one-sided job the household's submission contradicted, with any payments on it. */
export async function dropOneSided(db: Db, engagement: EngagementId): Promise<void> {
  await db.query(
    `DELETE FROM job_payments WHERE engagement_id IN
       (SELECT engagement_id FROM job_records WHERE engagement_id = $1 AND NOT attested)`,
    [engagement],
  );
  await db.query("DELETE FROM job_records WHERE engagement_id = $1 AND NOT attested", [engagement]);
}

/** The caller's side of a stored job and its status, or undefined when it is not stored or not theirs. */
export interface Party {
  side: Side;
  status: JobRecordStatus;
}

export async function partyOf(db: Db, engagement: EngagementId, user: UserId): Promise<Party | undefined> {
  const { rows } = await db.query<Party>(
    `SELECT CASE WHEN worker_id = $2 THEN $3 ELSE $4 END AS side, status FROM job_records
     WHERE engagement_id = $1 AND (worker_id = $2 OR household_id = $2)`,
    [engagement, user, Side.worker, Side.household],
  );
  return rows[0];
}

/** Moves an agreed job to done or cancelled, stamping when. */
export async function setStatus(db: Db, engagement: EngagementId, status: JobRecordStatus, at: Date): Promise<void> {
  await db.query(
    `UPDATE job_records SET status = $2,
       done_at = CASE WHEN $2 = $4 THEN $3 ELSE done_at END,
       cancelled_at = CASE WHEN $2 = $4 THEN cancelled_at ELSE $3 END
     WHERE engagement_id = $1 AND status = $5`,
    [engagement, status, at, DONE, AGREED],
  );
}

/** Sets or replaces the household's stars on a job. */
export async function setStars(db: Db, engagement: EngagementId, stars: number, at: Date): Promise<void> {
  await db.query("UPDATE job_records SET stars = $2, rated_at = $3 WHERE engagement_id = $1", [engagement, stars, at]);
}

/** A stored job as the export reads it. */
export interface RecordRowOut extends JobColumns, QuantityColumns {
  engagement_id: EngagementId;
  worker_id: UserId;
  household_id: UserId | null;
  price_paise: number;
  status: JobRecordStatus;
  attested: boolean;
  agreed_at: Date;
  done_at: Date | null;
  cancelled_at: Date | null;
  stars: number | null;
}

/** A page of the caller's stored jobs, oldest first, one row more than asked so the caller knows there is a next. */
export async function recordsPage(db: Db, user: UserId, page: RecordsPage): Promise<RecordRowOut[]> {
  const { rows } = await db.query<RecordRowOut>(
    `SELECT engagement_id, worker_id, household_id, trade, scope_problem, scope_rooms, scope_frequency, scope_people,
       scope_meals, scope_hours_band, scope_labour_only, to_char(work_day, 'YYYY-MM-DD') AS work_day, work_daily,
       work_window, materials_by, coats, hours_per_day, price_paise, status, attested, agreed_at, done_at, cancelled_at,
       stars, qty_area_band, qty_rooms, qty_surface, qty_floors, qty_house_type, qty_finish, qty_people, qty_days_week,
       qty_tasks, qty_hours, qty_vehicle, qty_points
     FROM job_records
     WHERE (worker_id = $1 OR household_id = $1) AND ($2::text IS NULL OR engagement_id > $2)
     ORDER BY engagement_id LIMIT $3`,
    [user, page.after ?? null, page.limit + 1],
  );
  return rows;
}
