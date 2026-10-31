import type { AreaKey, Trade } from "@gigsync/protocol";
import type { JobColumns } from "../records/fields.js";
import { CANCELLED } from "../records/sides.js";
import type { Db } from "./client.js";

/** One market group: a trade's scope bucket, in an area (or the whole city), agreed since a day. */
export interface MarketKey {
  trade: Trade;
  /** The scope columns as a record stores them; NULL where the trade has none. */
  scope: Pick<
    JobColumns,
    | "scope_problem"
    | "scope_rooms"
    | "scope_frequency"
    | "scope_people"
    | "scope_meals"
    | "scope_hours_band"
    | "scope_labour_only"
  >;
  area: AreaKey | undefined;
  since: Date;
}

/**
 * How many jobs a group holds, between how many different workers and households, and the percentiles of their agreed
 * prices (paise, unrounded); none for no jobs.
 */
export interface GroupFigures {
  jobs: number;
  workers: number;
  households: number;
  percentiles: number[] | null;
}

/** The figures for the request's area and for the whole city, from one statement. */
export interface MarketFigures {
  area: GroupFigures;
  city: GroupFigures;
}

interface Row {
  area_jobs: number;
  area_workers: number;
  area_households: number;
  area_percentiles: number[] | null;
  city_jobs: number;
  city_workers: number;
  city_households: number;
  city_percentiles: number[] | null;
}

/**
 * Counts and percentiles of the prices agreed in job records for one trade and scope bucket (ADR 0039 §1): attested
 * and one-sided jobs alike, never cancelled ones, agreed on or after `since`. Postgres computes the percentiles
 * (`percentile_cont`, linear interpolation, as `stats.ts` does), so no single price ever leaves the database. Every
 * record is in the one City (see migration 0010), so the city's group is every record of the bucket. A household that
 * deleted its records (household_id NULL) counts as one household per job.
 */
export async function marketFigures(db: Db, key: MarketKey, percentiles: readonly number[]): Promise<MarketFigures> {
  const s = key.scope;
  const { rows } = await db.query<Row>(
    `SELECT count(*) FILTER (WHERE area_key = $9::text)::int AS area_jobs,
       count(DISTINCT worker_id) FILTER (WHERE area_key = $9::text)::int AS area_workers,
       count(DISTINCT coalesce(household_id, engagement_id)) FILTER (WHERE area_key = $9::text)::int AS area_households,
       percentile_cont($12::float8[]) WITHIN GROUP (ORDER BY price_paise) FILTER (WHERE area_key = $9::text)
         AS area_percentiles,
       count(*)::int AS city_jobs,
       count(DISTINCT worker_id)::int AS city_workers,
       count(DISTINCT coalesce(household_id, engagement_id))::int AS city_households,
       percentile_cont($12::float8[]) WITHIN GROUP (ORDER BY price_paise) AS city_percentiles
     FROM job_records
     WHERE trade = $1 AND scope_problem IS NOT DISTINCT FROM $2 AND scope_rooms IS NOT DISTINCT FROM $3
       AND scope_frequency IS NOT DISTINCT FROM $4 AND scope_people IS NOT DISTINCT FROM $5
       AND scope_meals IS NOT DISTINCT FROM $6 AND scope_hours_band IS NOT DISTINCT FROM $7
       AND scope_labour_only IS NOT DISTINCT FROM $8 AND status <> $10 AND agreed_at >= $11`,
    [
      key.trade,
      s.scope_problem,
      s.scope_rooms,
      s.scope_frequency,
      s.scope_people,
      s.scope_meals,
      s.scope_hours_band,
      s.scope_labour_only,
      key.area ?? null,
      CANCELLED,
      key.since,
      [...percentiles],
    ],
  );
  const r = rows[0];
  return {
    area: {
      jobs: r?.area_jobs ?? 0,
      workers: r?.area_workers ?? 0,
      households: r?.area_households ?? 0,
      percentiles: r?.area_percentiles ?? null,
    },
    city: {
      jobs: r?.city_jobs ?? 0,
      workers: r?.city_workers ?? 0,
      households: r?.city_households ?? 0,
      percentiles: r?.city_percentiles ?? null,
    },
  };
}
