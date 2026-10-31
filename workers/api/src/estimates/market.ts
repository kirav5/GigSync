import { type AreaKey, type EstimateRequest, RateUnit } from "@gigsync/protocol";
import type { Db } from "../db/client.js";
import { type GroupFigures, marketFigures } from "../db/market-prices.js";
import { columnsOf } from "../records/fields.js";
import { K_MIN, MARKET_MONTHS, Percentile } from "./constants.js";
import { estimateUnit } from "./normalise.js";
import type { Band } from "./stats.js";

/**
 * Market prices from job records (ADR 0039 §1): the 25th, 50th and 75th percentiles of the prices agreed on GigSync
 * for the request's trade and scope bucket over the last `MARKET_MONTHS`, in its area when at least `K_MIN` jobs fall
 * there, else across the city when at least `K_MIN` do there; else none, and the web's quotes answer. The jobs must
 * also be between at least `K_MIN` different workers and `K_MIN` different households: ten jobs of one pair would show
 * that pair's price, and one worker with a second account could set a quiet area's range. Below that nothing about the
 * group is returned, not even its count, so no one person's price can be read from a range.
 */

/** A range from GigSync's own prices: the band, how many jobs it rests on, and the area (absent for the city). */
export interface MarketBand {
  band: Band;
  jobs: number;
  area?: AreaKey;
}

const PERCENTILES = [Percentile.low, Percentile.typical, Percentile.high] as const;

/** The first day counted: the same moment `MARKET_MONTHS` calendar months ago. */
export function marketSince(now: Date): Date {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - MARKET_MONTHS);
  return since;
}

/** A group's band when it holds at least `K_MIN` jobs, workers and households. */
function bandOfGroup(group: GroupFigures): Band | undefined {
  const [low, typical, high] = group.percentiles ?? [];
  if (Math.min(group.jobs, group.workers, group.households) < K_MIN) return undefined;
  if (low === undefined || typical === undefined || high === undefined) return undefined;
  return { low, typical, high };
}

/**
 * The market band for a request, or undefined. A per-square-foot request (painting with no rooms) has none: a job
 * record's price is for the whole job.
 */
export async function marketBand(db: Db, req: EstimateRequest, now: Date): Promise<MarketBand | undefined> {
  if (estimateUnit(req) === RateUnit.enum.sqft) return undefined;
  // An estimate request's trade and scope are a job's work: the same buckets, the same columns.
  const scope = columnsOf(req, {});
  const figures = await marketFigures(
    db,
    { trade: req.trade, scope, area: req.area, since: marketSince(now) },
    PERCENTILES,
  );
  const inArea = req.area ? bandOfGroup(figures.area) : undefined;
  if (inArea && req.area) return { band: inArea, jobs: figures.area.jobs, area: req.area };
  const inCity = bandOfGroup(figures.city);
  return inCity && { band: inCity, jobs: figures.city.jobs };
}
