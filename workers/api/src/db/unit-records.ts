import { type AreaKey, type Arrangement, DEFAULT_ARRANGEMENT, type Trade } from "@gigsync/protocol";
import type { JobColumns } from "../records/fields.js";
import { CANCELLED } from "../records/sides.js";
import type { Db } from "./client.js";
import type { QuantityColumns } from "./record-quantities.js";

/**
 * Agreed jobs of one trade, for GigSync's own per-unit rates (ADR 0041 §3): each job's price with what it was for
 * (scope buckets and quantities), when and where it was agreed, and who its two sides were, only so the engine can
 * count distinct workers and households. Prices never leave the server: the engine turns them into group percentiles
 * and shows nothing of a group below `K_MIN` jobs, workers and households.
 */
export interface UnitRow
  extends Pick<
      JobColumns,
      | "scope_problem"
      | "scope_rooms"
      | "scope_frequency"
      | "scope_people"
      | "scope_meals"
      | "scope_hours_band"
      | "scope_labour_only"
    >,
    QuantityColumns {
  price_paise: number;
  agreed_at: Date;
  area_key: AreaKey | null;
  worker_id: string;
  /** The household, or the engagement for a household that deleted its records: one household per such job. */
  household: string;
}

/** The most recent jobs read for one estimate: enough for any area's percentiles, few enough for 10 ms of CPU. */
export const MAX_UNIT_ROWS = 2000;

/**
 * One city's jobs (ADR 0061) of one trade and arrangement (ADR 0046; a record without one was monthly) agreed on or after `since`,
 * attested and one-sided alike, never cancelled, newest first.
 */
export async function unitRows(
  db: Db,
  city: string,
  trade: Trade,
  arrangement: Arrangement,
  since: Date,
): Promise<UnitRow[]> {
  const { rows } = await db.query<UnitRow>(
    `SELECT price_paise, agreed_at, area_key, worker_id, coalesce(household_id, engagement_id) AS household,
       scope_problem, scope_rooms, scope_frequency, scope_people, scope_meals, scope_hours_band, scope_labour_only,
       qty_area_band, qty_rooms, qty_surface, qty_floors, qty_house_type, qty_finish, qty_people, qty_days_week,
       qty_tasks, qty_hours, qty_vehicle, qty_points, qty_arrangement
     FROM job_records
     WHERE trade = $1 AND city = $7 AND status <> $2 AND agreed_at >= $3 AND coalesce(qty_arrangement, $5) = $6
     ORDER BY agreed_at DESC LIMIT $4`,
    [trade, CANCELLED, since, MAX_UNIT_ROWS, DEFAULT_ARRANGEMENT, arrangement, city],
  );
  return rows;
}
