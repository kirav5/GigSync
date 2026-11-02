import {
  AcProblem,
  type AreaKey,
  Arrangement,
  CarpenterProblem,
  type City,
  DEFAULT_SCOPE,
  DetailFlag,
  type DriverValues,
  ElectricianProblem,
  type Estimate,
  EstimateBasisKind,
  EstimateRequest,
  hasArrangements,
  hoursBand,
  type JobTrade,
  MaidFrequency,
  mealsBucket,
  PlumberProblem,
  peopleBand,
  QuestionKey,
  RateUnit,
  roomsBucket,
  Trade,
} from "@gigsync/protocol";
import { countIn } from "../job/details.js";
import { detailsToDrivers, tradeDrivers } from "./driver-details.js";

/**
 * A job's details as an estimate request (ADR 0030 §1): the structured details that change the price for its trade,
 * coarsened into the protocol's buckets, and never the household's own words. A detail the job does not give takes
 * the trade's default, so a worker's card (no job yet) and a household that skipped a question both get a range,
 * and the range says which scope it is for.
 */

const T = Trade.enum;
const Q = QuestionKey.enum;

/** The details each trade's scope already prices: the city band's scope rules for these no longer apply. */
export const SCOPE_KEYS: Readonly<Record<Trade, readonly QuestionKey[]>> = {
  [T.electrician]: [Q.problem],
  [T.plumber]: [Q.problem],
  [T.maid]: [Q.rooms, Q.frequency],
  [T.carpenter]: [Q.problem],
  [T.ac_technician]: [Q.problem],
  [T.painter]: [Q.rooms, Q.labour_only],
  [T.cook]: [Q.people, Q.meals],
  [T.driver]: [Q.hours],
};

type Details = Readonly<Record<string, string>>;

/** A count detail as a bucket, or the default when it holds no number. */
function counted<B>(details: Details, key: QuestionKey, toBucket: (n: number) => B, fallback: B): B {
  const n = countIn(details[key]);
  return n === undefined ? fallback : toBucket(n);
}

/** A problem kind the household's app wrote as the enum value, else the trade's "other": free text never maps. */
const problemOf = <E extends string>(details: Details, kinds: readonly E[], fallback: E): E =>
  kinds.find((k) => k === details[Q.problem]) ?? fallback;

/**
 * A painting job with rooms is priced per job; with only an area in square feet, per square foot (the phone then
 * multiplies, `perJob`); with neither, as the default 2BHK.
 */
function painterScope(details: Details) {
  const d = DEFAULT_SCOPE[T.painter];
  const labour = DetailFlag.safeParse(details[Q.labour_only]).data ?? d.labour_only;
  const rooms = countIn(details[Q.rooms]);
  if (rooms !== undefined) return { rooms: roomsBucket(rooms), labour_only: labour };
  return countIn(details[Q.area_sqft]) ? { labour_only: labour } : { ...d, labour_only: labour };
}

/**
 * A job's scope for its trade, in the protocol's buckets: what an estimate request carries and what a job record keeps
 * (ADR 0038). Checked by the caller's schema.
 */
export function tradeScope(trade: Trade, details: Details = {}): object {
  const d = DEFAULT_SCOPE;
  const scopes: Readonly<Record<Trade, object>> = {
    [T.electrician]: { problem: problemOf(details, ElectricianProblem.options, d.electrician.problem) },
    [T.plumber]: { problem: problemOf(details, PlumberProblem.options, d.plumber.problem) },
    [T.carpenter]: { problem: problemOf(details, CarpenterProblem.options, d.carpenter.problem) },
    [T.ac_technician]: { problem: problemOf(details, AcProblem.options, d.ac_technician.problem) },
    [T.maid]: {
      rooms: counted(details, Q.rooms, roomsBucket, d.maid.rooms),
      frequency: MaidFrequency.safeParse(details[Q.frequency]).data ?? d.maid.frequency,
    },
    [T.painter]: painterScope(details),
    [T.cook]: {
      people: counted(details, Q.people, peopleBand, d.cook.people),
      meals: counted(details, Q.meals, mealsBucket, d.cook.meals),
    },
    [T.driver]: { hours: counted(details, Q.hours, hoursBand, d.driver.hours) },
  };
  return scopes[trade];
}

/**
 * The estimate request for a job of `trade` in `city` with these details, in `area` (a pilot area's slug) when the job
 * is in one, so GigSync's prices there can answer first (ADR 0039 §1); undefined only if it fails the schema.
 */
export function estimateRequest(
  city: City,
  trade: Trade,
  details: Details = {},
  area?: AreaKey,
  drivers?: DriverValues,
): EstimateRequest | undefined {
  // The job's details are its drivers when none are passed: otherwise every driver would count as unknown.
  const known = tradeDrivers(trade, drivers ?? detailsToDrivers(trade, details));
  const arrangement = arrangementIn(trade, details);
  return EstimateRequest.safeParse({
    city,
    ...(area ? { area } : {}),
    trade,
    scope: tradeScope(trade, details),
    ...(known && Object.keys(known).length > 0 ? { drivers: known } : {}),
    ...(arrangement ? { arrangement } : {}),
  }).data;
}

/** The arrangement a job's details name (ADR 0046), for a trade priced by arrangement; undefined otherwise. */
export function arrangementIn(trade: JobTrade, details: Details): Arrangement | undefined {
  if (!hasArrangements(trade)) return undefined;
  return Arrangement.safeParse(details[Q.arrangement]).data;
}

/** Two requests ask for the same estimate. */
export const sameRequest = (a: EstimateRequest | undefined, b: EstimateRequest | undefined): boolean =>
  a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);

/**
 * The estimate for the whole job: a per-square-foot estimate times the job's area, when it gives one; any other unit
 * as it is. Undefined when a per-square-foot estimate has no area to multiply.
 */
export function perJob(estimate: Estimate, details: Details): Estimate | undefined {
  if (estimate.unit !== RateUnit.enum.sqft) return estimate;
  const area = countIn(details[Q.area_sqft]);
  if (!area) return undefined;
  return {
    ...estimate,
    unit: RateUnit.enum.job,
    low_paise: estimate.low_paise * area,
    typical_paise: estimate.typical_paise * area,
    high_paise: estimate.high_paise * area,
  };
}

/**
 * What an estimate rests on, counted: the GigSync jobs it was computed from (ADR 0039), or nothing to count for a range
 * that rests on the city's rate card (ADR 0041), which its own lines name.
 */
export const basisCount = (estimate: Estimate): { jobs: number } | Record<string, never> =>
  estimate.basis.kind === EstimateBasisKind.enum.gigsync ? { jobs: estimate.basis.gigsync_jobs } : {};
