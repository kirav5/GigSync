import { type PaiseRange, typicalFactor } from "@gigsync/core";
import { AreaBand, type AreaKey, DetailFlag, type DriverValues, driversFromScope, type Trade } from "@gigsync/protocol";
import type { UnitRow } from "../db/unit-records.js";
import { K_MIN, MARKET_MONTHS, Percentile } from "./constants.js";

/**
 * GigSync's own per-unit rates (ADR 0041 §3): each agreed price divided by its job's factor (quantity times
 * adjustments, unknown drivers at their defaults, old records' buckets read as drivers), weighted by recency, as the
 * 25th, 50th and 75th weighted percentiles. A group counts only with at least `K_MIN` jobs between `K_MIN` workers
 * and `K_MIN` households (ADR 0039 §1); the area's rate leans in as its jobs grow, the city's fills the rest.
 */

/** A job agreed this many days ago weighs half as much as one agreed today. ASSUMED; checked by the back-test. */
export const RECENCY_HALF_LIFE_DAYS = 180;
/** The area's rate has half the say once it holds this many jobs: area / (area + this). ASSUMED. */
export const AREA_LEAN_JOBS = 20;
const DAY_MS = 86_400_000;

/** The first day counted: the same moment `MARKET_MONTHS` calendar months ago. */
export function marketSince(now: Date): Date {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - MARKET_MONTHS);
  return since;
}

/** The sq ft an area band stands for: its middle, and 6,000 for the open top band. */
const AREA_MID: Readonly<Record<AreaBand, number>> = {
  "1_800": 600,
  "801_1200": 1000,
  "1201_1800": 1500,
  "1801_2500": 2150,
  "2501_3500": 3000,
  "3501_5000": 4250,
  "5001_plus": 6000,
};

/** A per-unit rate from GigSync's jobs, how many it rests on and how much they weigh together. */
export interface UnitRate {
  rate: PaiseRange;
  jobs: number;
  /** Kish's effective sample size of the recency weights: what the confidence label reads. */
  effective: number;
  /** The area whose jobs the rate leans on, when they pass the thresholds. */
  area?: AreaKey;
}

const present = (o: Record<string, string | number | null>): DriverValues =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as DriverValues;

/** What a record says about its job, as drivers: its buckets, then its quantities over them. */
export function rowDrivers(trade: Trade, r: UnitRow): DriverValues {
  const labour =
    r.scope_labour_only === null ? undefined : r.scope_labour_only ? DetailFlag.enum.yes : DetailFlag.enum.no;
  const fromScope = driversFromScope(trade, {
    ...(r.scope_problem ? { problem: r.scope_problem } : {}),
    ...(r.scope_rooms ? { rooms: r.scope_rooms } : {}),
    ...(r.scope_frequency ? { frequency: r.scope_frequency } : {}),
    ...(r.scope_people ? { people: r.scope_people } : {}),
    ...(r.scope_meals ? { meals: r.scope_meals } : {}),
    ...(r.scope_hours_band ? { hours: r.scope_hours_band } : {}),
    ...(labour ? { labour_only: labour } : {}),
  });
  const band = AreaBand.safeParse(r.qty_area_band).data;
  const quantities = present({
    area_sqft: band ? AREA_MID[band] : null,
    rooms: r.qty_rooms,
    surface: r.qty_surface,
    floors: r.qty_floors,
    house_type: r.qty_house_type,
    finish: r.qty_finish,
    people: r.qty_people,
    days_week: r.qty_days_week,
    tasks: r.qty_tasks,
    hours: r.qty_hours,
    vehicle: r.qty_vehicle,
    points: r.qty_points,
  });
  return { ...fromScope, ...quantities };
}

interface Weighted {
  value: number;
  weight: number;
  row: UnitRow;
}

/** The p-th weighted percentile of values sorted ascending: the first value whose cumulative weight reaches p. */
function weightedPercentile(sorted: readonly Weighted[], p: number): number {
  const total = sorted.reduce((sum, w) => sum + w.weight, 0);
  let cumulative = 0;
  for (const w of sorted) {
    cumulative += w.weight;
    if (cumulative >= p * total) return w.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

/** A group's rate and weight, when it passes the thresholds. */
function groupRate(group: readonly Weighted[]): { rate: PaiseRange; effective: number } | undefined {
  const workers = new Set(group.map((w) => w.row.worker_id)).size;
  const households = new Set(group.map((w) => w.row.household)).size;
  if (Math.min(group.length, workers, households) < K_MIN) return undefined;
  const sorted = [...group].sort((a, b) => a.value - b.value);
  const sum = group.reduce((s, w) => s + w.weight, 0);
  const squares = group.reduce((s, w) => s + w.weight * w.weight, 0);
  return {
    rate: {
      low: weightedPercentile(sorted, Percentile.low),
      typical: weightedPercentile(sorted, Percentile.typical),
      high: weightedPercentile(sorted, Percentile.high),
    },
    effective: (sum * sum) / squares,
  };
}

const mix = (a: PaiseRange, b: PaiseRange, share: number): PaiseRange => ({
  low: a.low * share + b.low * (1 - share),
  typical: a.typical * share + b.typical * (1 - share),
  high: a.high * share + b.high * (1 - share),
});

/** GigSync's per-unit rate for a trade, leaning to `area` as its jobs grow; undefined below the thresholds. */
export function unitRate(
  trade: Trade,
  rows: readonly UnitRow[],
  area: AreaKey | undefined,
  now: Date,
): UnitRate | undefined {
  const weighted: Weighted[] = rows.map((row) => ({
    value: row.price_paise / typicalFactor(trade, rowDrivers(trade, row)),
    weight: 0.5 ** ((now.getTime() - row.agreed_at.getTime()) / DAY_MS / RECENCY_HALF_LIFE_DAYS),
    row,
  }));
  const city = groupRate(weighted);
  if (!city) return undefined;
  const inArea = area ? weighted.filter((w) => w.row.area_key === area) : [];
  const local = area ? groupRate(inArea) : undefined;
  if (!local || !area) return { rate: city.rate, jobs: rows.length, effective: city.effective };
  const share = inArea.length / (inArea.length + AREA_LEAN_JOBS);
  return { rate: mix(local.rate, city.rate, share), jobs: rows.length, effective: city.effective, area };
}
