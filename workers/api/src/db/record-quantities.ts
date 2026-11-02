import { type EngagementId, JobQuantities } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** What every quantity column's name starts with. */
const QTY_PREFIX = "qty_";

/** The quantity columns of job_records (migration 0011), NULL where a record has none. */
export interface QuantityColumns {
  qty_area_band: string | null;
  qty_rooms: number | null;
  qty_surface: string | null;
  qty_floors: number | null;
  qty_house_type: string | null;
  qty_finish: string | null;
  qty_people: number | null;
  qty_days_week: number | null;
  qty_tasks: string | null;
  qty_hours: number | null;
  qty_vehicle: string | null;
  qty_points: number | null;
  /** ADR 0046 (migration 0012): how long the job was for; NULL was monthly. */
  qty_arrangement: string | null;
}

export function quantityColumns(q: JobQuantities | undefined): QuantityColumns {
  return {
    qty_area_band: q?.area_band ?? null,
    qty_rooms: q?.rooms ?? null,
    qty_surface: q?.surface ?? null,
    qty_floors: q?.floors ?? null,
    qty_house_type: q?.house_type ?? null,
    qty_finish: q?.finish ?? null,
    qty_people: q?.people ?? null,
    qty_days_week: q?.days_week ?? null,
    qty_tasks: q?.tasks ?? null,
    qty_hours: q?.hours ?? null,
    qty_vehicle: q?.vehicle ?? null,
    qty_points: q?.points ?? null,
    qty_arrangement: q?.arrangement ?? null,
  };
}

/** Sets a stored job's quantities, replacing what it had: called in the same transaction that stored the job. */
export async function setQuantities(db: Db, engagement: EngagementId, q: JobQuantities | undefined): Promise<void> {
  const c = quantityColumns(q);
  await db.query(
    `UPDATE job_records SET qty_area_band = $2, qty_rooms = $3, qty_surface = $4, qty_floors = $5,
       qty_house_type = $6, qty_finish = $7, qty_people = $8, qty_days_week = $9, qty_tasks = $10, qty_hours = $11,
       qty_vehicle = $12, qty_points = $13, qty_arrangement = $14
     WHERE engagement_id = $1`,
    [
      engagement,
      c.qty_area_band,
      c.qty_rooms,
      c.qty_surface,
      c.qty_floors,
      c.qty_house_type,
      c.qty_finish,
      c.qty_people,
      c.qty_days_week,
      c.qty_tasks,
      c.qty_hours,
      c.qty_vehicle,
      c.qty_points,
      c.qty_arrangement,
    ],
  );
}

/** A record's quantities back from its row (other columns ignored); undefined when it has none. Parsed, so a bad row fails loudly. */
export function quantitiesOf(c: QuantityColumns): JobQuantities | undefined {
  const q = Object.fromEntries(
    Object.entries(c)
      .filter(([k, v]) => k.startsWith(QTY_PREFIX) && v !== null)
      .map(([k, v]) => [k.slice(QTY_PREFIX.length), v]),
  );
  return Object.keys(q).length === 0 ? undefined : JobQuantities.parse(q);
}
