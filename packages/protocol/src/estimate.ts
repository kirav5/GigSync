import { z } from "zod";
import { City } from "./content.js";
import {
  AcScope,
  CarpenterScope,
  CookScope,
  DriverScope,
  ElectricianScope,
  MaidScope,
  PainterScope,
  PlumberScope,
  type TradeScope,
} from "./estimate-scope.js";
import { PAISE_PER_RUPEE } from "./payment.js";
import { Trade } from "./trade.js";

/**
 * Rate estimates (ADR 0030, ADR 0039 §1): `POST /v1/estimates` answers with the usual range for a job, computed by code
 * from the prices agreed on GigSync when at least `K_MIN` jobs fall in the group (the area, then the city), otherwise
 * from sourced web quotes. Suggestions only: the owner confirms or changes every number, and a job can be agreed with
 * no estimate at all.
 */

/** What a price is for: the whole job, a square foot, a day, a month, one visit or an hour. */
export const RateUnit = z.enum(["job", "sqft", "day", "month", "visit", "hour"]);
export type RateUnit = z.infer<typeof RateUnit>;

/** Estimates can exceed the UPI cap (a whole house painted with materials), so they get their own ceiling: ₹10 lakh. */
export const ESTIMATE_MAX_PAISE = 10_00_000 * PAISE_PER_RUPEE;
const EstimatePaise = z.number().int().positive().max(ESTIMATE_MAX_PAISE);
export const MAX_ESTIMATE_SOURCES = 30;
export const MAX_SOURCE_SENTENCE = 500;
const MAX_SITE = 253;

/** A neighbourhood as a slug ("jayanagar", "hsr-layout"): the pilot area's name, never an address. */
export const AreaKey = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "area slug")
  .max(60);
export type AreaKey = z.infer<typeof AreaKey>;

const T = Trade.enum;
const scoped = <K extends Trade, S extends z.ZodType<TradeScope[K]>>(trade: K, scope: S) =>
  z.object({ city: City, area: AreaKey.optional(), trade: z.literal(trade), scope });

/**
 * `POST /v1/estimates`: a city, the area when the job is in a pilot area, a trade and that trade's scope buckets.
 * Nothing a person wrote.
 */
export const EstimateRequest = z.discriminatedUnion("trade", [
  scoped(T.electrician, ElectricianScope),
  scoped(T.plumber, PlumberScope),
  scoped(T.maid, MaidScope),
  scoped(T.carpenter, CarpenterScope),
  scoped(T.ac_technician, AcScope),
  scoped(T.painter, PainterScope),
  scoped(T.cook, CookScope),
  scoped(T.driver, DriverScope),
]);
export type EstimateRequest = z.infer<typeof EstimateRequest>;

/** One quote an estimate rests on: the sentence as written on the page, and its number in its own unit. */
export const EstimateSource = z.object({
  url: z.url(),
  site: z.string().min(1).max(MAX_SITE),
  sentence: z.string().min(1).max(MAX_SOURCE_SENTENCE),
  amount_paise: EstimatePaise,
  unit: RateUnit,
});
export type EstimateSource = z.infer<typeof EstimateSource>;

/** What a range was computed from: prices agreed on GigSync, or quotes read from the web. */
export const EstimateBasisKind = z.enum(["gigsync", "web"]);
export type EstimateBasisKind = z.infer<typeof EstimateBasisKind>;

export const EstimateBasis = z.object({
  /** Which source the range rests on. An estimate a phone kept from before ADR 0039 has none, and was the web's. */
  kind: EstimateBasisKind.default(EstimateBasisKind.enum.web),
  /** The web quotes that survived every check, outliers removed; empty for a GigSync range. */
  sources: z.array(EstimateSource).max(MAX_ESTIMATE_SOURCES),
  /** The GigSync jobs a GigSync range rests on, never fewer than `K_MIN`; 0 for a web range. */
  gigsync_jobs: z.number().int().nonnegative(),
  /** The area those jobs are in; absent when the range is the whole city's, or the web's. */
  area: AreaKey.optional(),
  /** The statutory floor for this job, when one is known; no figure of the estimate is below it. */
  legal_minimum_paise: EstimatePaise.optional(),
  /** True when the floor raised at least one figure: the app says so. */
  floored: z.boolean(),
});
export type EstimateBasis = z.infer<typeof EstimateBasis>;

/** The usual range: low, typical and high are the 25th, 50th and 75th percentiles, rounded to ₹10. */
export const Estimate = z
  .object({
    low_paise: EstimatePaise,
    typical_paise: EstimatePaise,
    high_paise: EstimatePaise,
    unit: RateUnit,
    basis: EstimateBasis,
    /** When the web quotes were read, or the GigSync prices counted. */
    as_of: z.iso.datetime({ offset: true }),
  })
  .refine((e) => e.low_paise <= e.typical_paise && e.typical_paise <= e.high_paise, "low ≤ typical ≤ high");
export type Estimate = z.infer<typeof Estimate>;

/**
 * Why there is no estimate. The app falls back to the city rate card, then the owner's own numbers, whatever the
 * reason: `unavailable` (the server has no quote source), `too_few_quotes` (fewer than 3 checked quotes from 2 sites),
 * `pending` (another request is reading the web for this job right now; ask again later), `failed` (reading failed).
 */
export const NoEstimateReason = z.enum(["unavailable", "too_few_quotes", "pending", "failed"]);
export type NoEstimateReason = z.infer<typeof NoEstimateReason>;

export const NoEstimate = z.object({ none: NoEstimateReason });
export type NoEstimate = z.infer<typeof NoEstimate>;

export const EstimateResponse = z.union([Estimate, NoEstimate]);
export type EstimateResponse = z.infer<typeof EstimateResponse>;

export const isEstimate = (r: EstimateResponse): r is Estimate => !("none" in r);
