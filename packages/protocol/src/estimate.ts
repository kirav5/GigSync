import { z } from "zod";
import { AreaKey } from "./area-key.js";
import { Arrangement, hasArrangements } from "./arrangement.js";
import { City } from "./content.js";
import {
  AcDrivers,
  CarpenterDrivers,
  ChauffeurDrivers,
  Confidence,
  CookDrivers,
  DriverName,
  ElectricianDrivers,
  MaidDrivers,
  PainterDrivers,
  PlumberDrivers,
  PriceUnit,
} from "./estimate-drivers.js";
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
 * Rate estimates (ADR 0039 §1, ADR 0041): `POST /v1/estimates` answers with the usual range for a job, computed by code
 * from two sources only: the prices agreed on GigSync, when at least `K_MIN` jobs fall in the group (the area, then the
 * city), and the city's community rate card. No cloud model and no web search produces a price. Suggestions only: the
 * owner confirms or changes every number, and a job can be agreed with no estimate at all.
 */

/** What a price is for: the whole job, a square foot, a day, a month, one visit or an hour (ADR 0041's `PriceUnit`). */
export const RateUnit = PriceUnit;
export type RateUnit = PriceUnit;

/** Estimates can exceed the UPI cap (a whole house painted with materials), so they get their own ceiling: ₹10 lakh. */
export const ESTIMATE_MAX_PAISE = 10_00_000 * PAISE_PER_RUPEE;
const EstimatePaise = z.number().int().positive().max(ESTIMATE_MAX_PAISE);

export { AreaKey } from "./area-key.js";

const T = Trade.enum;
const scoped = <K extends Trade, S extends z.ZodType<TradeScope[K]>, D extends z.ZodType>(
  trade: K,
  scope: S,
  drivers: D,
) =>
  z.object({
    city: City,
    area: AreaKey.optional(),
    trade: z.literal(trade),
    scope,
    drivers: drivers.optional(),
    /** ADR 0046: for maid and driver work, how long it is for; the range is then in that arrangement's unit. */
    arrangement: Arrangement.optional(),
  });

/**
 * `POST /v1/estimates`: a city, the area when the job is in a pilot area, a trade and that trade's scope buckets.
 * Nothing a person wrote. A phone that knows ADR 0041's price drivers adds `drivers` (the values it knows; unknown
 * ones left out); an older phone sends the scope alone, which the server reads as drivers. Either way the range is
 * computed from per-unit rates, with a confidence label.
 */
export const EstimateRequest = z
  .discriminatedUnion("trade", [
    scoped(T.electrician, ElectricianScope, ElectricianDrivers),
    scoped(T.plumber, PlumberScope, PlumberDrivers),
    scoped(T.maid, MaidScope, MaidDrivers),
    scoped(T.carpenter, CarpenterScope, CarpenterDrivers),
    scoped(T.ac_technician, AcScope, AcDrivers),
    scoped(T.painter, PainterScope, PainterDrivers),
    scoped(T.cook, CookScope, CookDrivers),
    scoped(T.driver, DriverScope, ChauffeurDrivers),
  ])
  .refine((r) => r.arrangement === undefined || hasArrangements(r.trade), "no arrangements for this trade");
export type EstimateRequest = z.infer<typeof EstimateRequest>;

/**
 * What a range was computed from: prices agreed on GigSync, or a community rate card (ADR 0041: a city's card with
 * provenance per entry). An older phone knows only GigSync's and the web's: it cannot parse a rate card's range, and
 * falls back to the rate card it ships, which holds the same figures.
 */
export const EstimateBasisKind = z.enum(["gigsync", "rate_card"]);

/** Where a rate card's figure comes from: the source, who issued it, when, and where to read it. */
export const RateCardSource = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().min(1).max(120),
  date: z.string().min(1).max(40),
  /** A URL, or "to be confirmed" when none is known yet. */
  url: z.string().min(1).max(300),
});
export type RateCardSource = z.infer<typeof RateCardSource>;
const MAX_CARD_SOURCES = 6;
export type EstimateBasisKind = z.infer<typeof EstimateBasisKind>;

export const EstimateBasis = z.object({
  /** The source the range rests on most. */
  kind: EstimateBasisKind,
  /**
   * Always empty: web quotes are gone (ADR 0041). Sent only because a phone from before ADR 0041 requires the list and
   * otherwise drops a range from GigSync's jobs.
   */
  sources: z.tuple([]).optional(),
  /** The GigSync jobs the range rests on, never fewer than `K_MIN`; 0 when GigSync's jobs are not in the blend. */
  gigsync_jobs: z.number().int().nonnegative(),
  /** The area those jobs are in; absent when the range is the whole city's. */
  area: AreaKey.optional(),
  /** The statutory floor for this job, when one is known; no figure of the estimate is below it. */
  legal_minimum_paise: EstimatePaise.optional(),
  /** True when the floor raised at least one figure: the app says so. */
  floored: z.boolean(),
  /** ADR 0041: every source the per-unit rate blends, strongest first ("34 GigSync jobs + Bengaluru rate card"). */
  blend: z.array(EstimateBasisKind).max(EstimateBasisKind.options.length).optional(),
  /** ADR 0041: the rate card in the blend, by name ("Bengaluru rate card"), with the provenance of its figures. */
  rate_card: z
    .object({ name: z.string().min(1).max(80), sources: z.array(RateCardSource).max(MAX_CARD_SOURCES) })
    .optional(),
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
    /** When the range was computed. */
    as_of: z.iso.datetime({ offset: true }),
    /** ADR 0041: how sure the range is; absent on a range from before it. */
    confidence: Confidence.optional(),
    /** The drivers the range assumed because they were unknown, the one widening it most first. */
    assumed: z.array(DriverName).max(DriverName.options.length).optional(),
    /** The driver the spread mostly depends on ("mostly depends on outside walls"), known or assumed. */
    spread_by: DriverName.optional(),
  })
  .refine((e) => e.low_paise <= e.typical_paise && e.typical_paise <= e.high_paise, "low ≤ typical ≤ high");
export type Estimate = z.infer<typeof Estimate>;

/**
 * Why there is no estimate: `unavailable`, when neither GigSync's jobs nor the city's rate card covers the job. The
 * app falls back to the city rate card it ships, then the owner's own numbers.
 */
export const NoEstimateReason = z.enum(["unavailable"]);
export type NoEstimateReason = z.infer<typeof NoEstimateReason>;

export const NoEstimate = z.object({ none: NoEstimateReason });
export type NoEstimate = z.infer<typeof NoEstimate>;

export const EstimateResponse = z.union([Estimate, NoEstimate]);
export type EstimateResponse = z.infer<typeof EstimateResponse>;

export const isEstimate = (r: EstimateResponse): r is Estimate => !("none" in r);
