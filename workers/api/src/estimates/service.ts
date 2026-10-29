import { log } from "@gigsync/core/log";
import {
  type EstimateRequest,
  type EstimateResponse,
  NoEstimateReason,
  type SharedPrice,
  type UserId,
} from "@gigsync/protocol";
import { type Db, transaction } from "../db/client.js";
import {
  type CacheKey,
  claimReading,
  countShare,
  insertSharedPrice,
  lastReading,
  type Reading,
  sharedPrices,
  storeReading,
} from "../db/estimates.js";
import { assembleEstimate } from "./assemble.js";
import { webBand } from "./compute.js";
import { ESTIMATE_TTL_MS, LOCK_TTL_MS, MAX_SHARED_READ, MAX_SHARES_PER_DAY } from "./constants.js";
import { firstMonthCounted, isShareableMonth, monthStart, utcDay } from "./months.js";
import type { QuoteSource } from "./source.js";

const NONE = NoEstimateReason.enum;

/** The scope buckets as one stable string, keys sorted: "labour_only=yes;rooms=bhk2". */
export const bucketOf = (req: EstimateRequest): string =>
  Object.entries(req.scope)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join(";");

const keyOf = (req: EstimateRequest): CacheKey => ({
  city: req.city,
  trade: req.trade,
  bucket: bucketOf(req),
});

/** What serving an estimate needs: this request's directory connection, the quote source (if any) and its id. */
export interface EstimateContext {
  db: Db;
  source: QuoteSource | undefined;
  requestId?: string;
}

let warnedNoSource = false;

/**
 * Reads the web for a job type, once at a time: only the request that claims the row reads; others hear "pending".
 * A failed reading keeps its claim until the claim goes stale, which spaces out retries of a failing source.
 */
async function freshReading({ db, source, requestId }: EstimateContext, req: EstimateRequest, now: Date) {
  if (!source) {
    if (!warnedNoSource) log.warn("estimates unavailable: no ANTHROPIC_API_KEY and no fixture source", { requestId });
    warnedNoSource = true;
    return NONE.unavailable;
  }
  const key = keyOf(req);
  if (!(await claimReading(db, key, now, new Date(now.getTime() - LOCK_TTL_MS)))) return NONE.pending;
  try {
    const outcome = webBand(req, await source.quotes(req));
    const reading: Reading = { result: outcome.result, readAt: now };
    await storeReading(db, key, reading);
    log.info("estimate read", {
      requestId,
      trade: req.trade,
      bucket: key.bucket,
      source: source.name,
      quotes: typeof outcome.result === "string" ? 0 : outcome.result.count,
      dropped: outcome.dropped.length,
      reasons: [...new Set(outcome.dropped)],
    });
    return reading;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error("estimate reading failed", {
      requestId,
      trade: req.trade,
      source: source.name,
      error: error.name,
      message: error.message,
    });
    return NONE.failed;
  }
}

/**
 * The estimate for a request: the cached web reading when younger than `ESTIMATE_TTL_MS`, otherwise a new one (or
 * the old one while a new one cannot be had); blended with shared prices and floored (`assembleEstimate`). Never throws for a missing source or a failed
 * reading: those are "no estimate" with a reason.
 */
export async function serveEstimate(ctx: EstimateContext, req: EstimateRequest, now: Date): Promise<EstimateResponse> {
  const { db } = ctx;
  const key = keyOf(req);
  const [cached, shared] = await Promise.all([
    lastReading(db, key),
    sharedPrices(db, key, firstMonthCounted(now), MAX_SHARED_READ),
  ]);
  const fresh = cached && now.getTime() - cached.readAt.getTime() < ESTIMATE_TTL_MS ? cached : undefined;
  const attempt = fresh ?? (await freshReading(ctx, req, now));
  // A reading past its TTL still beats nothing while a new one is pending or failing; its date goes with it.
  const reading = typeof attempt === "string" && cached ? cached : attempt;
  const result = typeof reading === "string" ? reading : reading.result;
  const web = typeof result === "string" ? undefined : result;
  const readAt = typeof reading === "string" ? undefined : reading.readAt;
  const estimate = assembleEstimate(req, { web, readAt, shared }, now);
  if (estimate) return estimate;
  return { none: typeof result === "string" ? result : NONE.too_few_quotes };
}

/** How a share ended: stored, refused for its month, or refused because the user shared too many today. */
export const ShareOutcome = { stored: "stored", badMonth: "bad_month", tooMany: "too_many" } as const;
export type ShareOutcome = (typeof ShareOutcome)[keyof typeof ShareOutcome];

/** Stores a shared price with no user id, after counting it against the user's daily allowance, in one transaction. */
export async function sharePrice(db: Db, user: UserId, price: SharedPrice, now: Date): Promise<ShareOutcome> {
  if (!isShareableMonth(price.month, now)) return ShareOutcome.badMonth;
  const key = keyOf(price);
  const stored = await transaction(db, async () => {
    if (!(await countShare(db, user, utcDay(now), MAX_SHARES_PER_DAY))) return false;
    const row = { area_key: price.area_key, price_paise: price.price_paise, month: monthStart(price.month) };
    await insertSharedPrice(db, key, row);
    return true;
  });
  return stored ? ShareOutcome.stored : ShareOutcome.tooMany;
}
