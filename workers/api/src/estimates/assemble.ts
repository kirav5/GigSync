import { LEGAL_MINIMUM } from "@gigsync/core";
import {
  ESTIMATE_MAX_PAISE,
  type Estimate,
  EstimateBasisKind,
  type EstimateRequest,
  RateUnit,
} from "@gigsync/protocol";
import type { WebBand } from "./compute.js";
import { ROUND_PAISE, ROUND_SQFT_PAISE } from "./constants.js";
import type { MarketBand } from "./market.js";
import { estimateUnit, visitsPerMonth } from "./normalise.js";
import { type Band, roundTo, roundUpTo } from "./stats.js";

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

/** What a range was computed from: GigSync's agreed prices (`MarketBand`) or the web's checked quotes (`WebBand`). */
export type Basis =
  | { kind: typeof EstimateBasisKind.enum.gigsync; market: MarketBand }
  | { kind: typeof EstimateBasisKind.enum.web; web: WebBand; readAt: Date };

const bandOfBasis = (b: Basis): Band => (b.kind === EstimateBasisKind.enum.gigsync ? b.market.band : b.web.band);

/**
 * The estimate a phone sees: rounded to ₹10 (₹1 per sq ft) and raised to the legal floor where one applies, saying
 * so, with the basis it rests on: GigSync's jobs (how many, and in which area) or the web's sources (and when read).
 */
export function assembleEstimate(req: EstimateRequest, basis: Basis, now: Date): Estimate {
  const band = bandOfBasis(basis);
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
  const market = basis.kind === EstimateBasisKind.enum.gigsync ? basis.market : undefined;
  return {
    low_paise: low,
    typical_paise: typical,
    high_paise: high,
    unit,
    basis: {
      kind: basis.kind,
      sources: basis.kind === EstimateBasisKind.enum.web ? basis.web.sources : [],
      gigsync_jobs: market?.jobs ?? 0,
      ...(market?.area ? { area: market.area } : {}),
      ...(floor === undefined ? {} : { legal_minimum_paise: floor }),
      floored,
    },
    as_of: (basis.kind === EstimateBasisKind.enum.web ? basis.readAt : now).toISOString(),
  };
}
