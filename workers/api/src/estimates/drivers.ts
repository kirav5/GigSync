import {
  arrangementEntry,
  arrangementOf,
  driverSpread,
  estimateUnit,
  jobRange,
  KARNATAKA_MINIMUM,
} from "@gigsync/core";
import {
  type DriverValues,
  driversFromScope,
  EstimateBasisKind,
  type EstimateRequest,
  type EstimateResponse,
  NoEstimateReason,
  tradeDriversOnly,
} from "@gigsync/protocol";
import type { Db } from "../db/client.js";
import { unitRows } from "../db/unit-records.js";
import { blendParts, driverEstimate, type Part } from "./blend.js";
import { confidenceOf } from "./confidence.js";
import { legalFloorPaise } from "./floor.js";
import { marketSince, unitRate } from "./unit-rates.js";

/**
 * ADR 0041 §3, as the founders set it on 2026-10-31: a range from a job's drivers, from two sources only, GigSync's
 * agreed jobs (when they pass the 10/10/10 rule) and the city's community rate card, never a cloud model. Each
 * source's per-unit rate times the job's factor (quantity times adjustments) gives a band, which the drivers the owner
 * did not know widen; the bands are blended by weight, and the legal minimum is the floor. A request from an older
 * phone, with its scope buckets and no drivers, takes the same path: its buckets are read as drivers.
 */

/** The rate card weighs as much as this many GigSync jobs: ten or more jobs that pass the rule outweigh it. ASSUMED. */
export const RATE_CARD_WEIGHT = 5;

const NONE = NoEstimateReason.enum;
const K = EstimateBasisKind.enum;

/** The estimate for a request: from its drivers, or from its scope buckets read as drivers when it sends none. */
export async function serveEstimate(db: Db, req: EstimateRequest, now: Date): Promise<EstimateResponse> {
  const trade = req.trade;
  // The schema checked each trade's drivers; the cast only widens that union to the shape every trade shares.
  const sent = req.drivers as DriverValues | undefined;
  const drivers = tradeDriversOnly(trade, sent ?? driversFromScope(trade, req.scope));
  // ADR 0046: a maid or driver job is priced in its arrangement, from jobs and card figures of that arrangement only.
  const arrangement = arrangementOf(trade, req.arrangement);
  const spread = driverSpread(trade, drivers, arrangement);
  const rows = await unitRows(db, trade, arrangement, marketSince(now));
  const gigsync = unitRate(trade, rows, req.area, now, arrangement);
  const card = arrangementEntry(req.city, trade, arrangement);
  const parts: Part[] = [];
  if (gigsync) parts.push({ kind: K.gigsync, band: jobRange(gigsync.rate, spread), weight: gigsync.effective });
  if (card) parts.push({ kind: K.rate_card, band: jobRange(card.range, spread), weight: RATE_CARD_WEIGHT });
  const blended = blendParts(parts);
  if (!blended) return { none: NONE.unavailable };
  const floor = legalFloorPaise(req);
  const confidence = confidenceOf({
    blend: blended.kinds,
    effective: gigsync?.effective ?? 0,
    assumed: spread.assumed,
    widths: spread.widths,
  });
  return driverEstimate({
    band: blended.band,
    kinds: blended.kinds,
    unit: estimateUnit(trade, req.arrangement),
    floor,
    jobs: gigsync?.jobs ?? 0,
    ...(gigsync?.area ? { area: gigsync.area } : {}),
    ...(card ? { card: { sources: floor === undefined ? card.sources : [...card.sources, KARNATAKA_MINIMUM] } } : {}),
    confidence,
    assumed: spread.assumed,
    now,
  });
}
