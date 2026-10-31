import { log } from "@gigsync/core/log";
import { EstimateBasisKind, type EstimateRequest, type EstimateResponse, NoEstimateReason } from "@gigsync/protocol";
import type { Db } from "../db/client.js";
import { type CacheKey, claimReading, lastReading, type Reading, storeReading } from "../db/estimates.js";
import { assembleEstimate } from "./assemble.js";
import { type WebBand, webBand } from "./compute.js";
import { ESTIMATE_TTL_MS, LOCK_TTL_MS } from "./constants.js";
import { marketBand } from "./market.js";
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

/** The web's answer: a band with when it was read, or why there is none. */
type WebAnswer = { web: WebBand; readAt: Date } | NoEstimateReason;

/**
 * The web's band for a request: the cached reading when younger than `ESTIMATE_TTL_MS`, otherwise a new one (or the
 * old one, with its date, while a new one cannot be had). A source that is not cached (the local fixture) is read every
 * time and never touches the cache.
 */
async function webAnswer(ctx: EstimateContext, req: EstimateRequest, now: Date): Promise<WebAnswer> {
  const { db, source } = ctx;
  if (source && !source.cached) {
    const result = webBand(req, await source.quotes(req)).result;
    return typeof result === "string" ? result : { web: result, readAt: now };
  }
  const cached = await lastReading(db, keyOf(req));
  const fresh = cached && now.getTime() - cached.readAt.getTime() < ESTIMATE_TTL_MS ? cached : undefined;
  const attempt = fresh ?? (await freshReading(ctx, req, now));
  const reading = typeof attempt === "string" && cached ? cached : attempt;
  if (typeof reading === "string") return reading;
  return typeof reading.result === "string" ? reading.result : { web: reading.result, readAt: reading.readAt };
}

/**
 * The estimate for a request (ADR 0039 §1): from the prices agreed on GigSync when at least `K_MIN` jobs fall in the
 * area or else the city (`marketBand`), otherwise from the web's quotes (ADR 0030); the legal floor applies to both
 * (`assembleEstimate`). Never throws for a missing source or a failed reading: those are "no estimate" with a reason.
 */
export async function serveEstimate(ctx: EstimateContext, req: EstimateRequest, now: Date): Promise<EstimateResponse> {
  const market = await marketBand(ctx.db, req, now);
  if (market) return assembleEstimate(req, { kind: EstimateBasisKind.enum.gigsync, market }, now);
  const answer = await webAnswer(ctx, req, now);
  if (typeof answer === "string") return { none: answer };
  return assembleEstimate(req, { kind: EstimateBasisKind.enum.web, ...answer }, now);
}
