import { LEGAL_MINIMUM } from "@gigsync/core";
import { ESTIMATE_MAX_PAISE, type Estimate, type EstimateRequest, RateUnit } from "@gigsync/protocol";
import type { WebBand } from "./compute.js";
import { K_MIN, ROUND_PAISE, ROUND_SQFT_PAISE } from "./constants.js";
import { estimateUnit, visitsPerMonth } from "./normalise.js";
import { type Band, bandOf, roundTo, roundUpTo, withoutOutliers } from "./stats.js";

/**
 * The statutory floor for a monthly job, in paise, when the city's legal minimum covers the trade: the notified day
 * rate pro-rated to the hours the rate card assumes (`LEGAL_MINIMUM` in core's city-rates.ts), times the days a month
 * the job is worked. Rounded up to ₹10 so a figure is never shown below the law.
 */
export function legalFloorPaise(req: EstimateRequest): number | undefined {
  if (estimateUnit(req) !== RateUnit.enum.month || req.city !== LEGAL_MINIMUM.city.toLowerCase()) return undefined;
  const rate = LEGAL_MINIMUM.trades[req.trade];
  if (!rate) return undefined;
  const perDay = (rate.day_paise * rate.hours) / LEGAL_MINIMUM.day_hours;
  return roundUpTo(perDay * visitsPerMonth(req), ROUND_PAISE);
}

interface Weighted {
  band: Band;
  count: number;
}

/** Shared prices count only from `K_MIN` up, outliers removed like the web's; below that they stay unused. */
function sharedBand(prices: readonly number[]): Weighted | undefined {
  if (prices.length < K_MIN) return undefined;
  const inside = withoutOutliers(prices, (p) => p);
  const band = bandOf(inside);
  return band && { band, count: inside.length };
}

/**
 * Blends the web's percentiles with shared GigSync prices', weighted by how many prices each rests on:
 *   figure = (n_web × web_figure + n_shared × shared_figure) / (n_web + n_shared), for low, typical and high alike.
 * Either side alone stands when the other is missing.
 */
function blend(parts: readonly Weighted[]): Band | undefined {
  const total = parts.reduce((n, p) => n + p.count, 0);
  if (total === 0) return undefined;
  const mean = (pick: (b: Band) => number) => parts.reduce((sum, p) => sum + pick(p.band) * p.count, 0) / total;
  return { low: mean((b) => b.low), typical: mean((b) => b.typical), high: mean((b) => b.high) };
}

/** What the estimate is assembled from: the web band (if any), when it was read, and shared prices for the bucket. */
interface Parts {
  web: WebBand | undefined;
  readAt: Date | undefined;
  shared: readonly number[];
}

/**
 * The estimate a phone sees: blended, rounded to ₹10 (₹1 per sq ft), and raised to the legal floor where one applies,
 * saying so. Undefined when neither the web nor enough shared prices give a band.
 */
export function assembleEstimate(req: EstimateRequest, parts: Parts, now: Date): Estimate | undefined {
  const fromShared = sharedBand(parts.shared);
  const weighted = [parts.web, fromShared].filter((p): p is Weighted => p !== undefined);
  const band = blend(weighted);
  if (!band) return undefined;
  const unit = estimateUnit(req);
  const step = unit === RateUnit.enum.sqft ? ROUND_SQFT_PAISE : ROUND_PAISE;
  const floor = legalFloorPaise(req);
  let floored = false;
  const figure = (value: number) => {
    const rounded = Math.min(roundTo(value, step), ESTIMATE_MAX_PAISE);
    if (floor === undefined || rounded >= floor) return rounded;
    floored = true;
    return floor;
  };
  const low = figure(band.low);
  const typical = figure(band.typical);
  const high = figure(band.high);
  return {
    low_paise: low,
    typical_paise: typical,
    high_paise: high,
    unit,
    basis: {
      sources: parts.web?.sources ?? [],
      gigsync_jobs: fromShared?.count ?? 0,
      ...(floor === undefined ? {} : { legal_minimum_paise: floor }),
      floored,
    },
    as_of: (parts.readAt ?? now).toISOString(),
  };
}
