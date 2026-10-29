import {
  AcProblem,
  CarpenterProblem,
  type City,
  DEFAULT_SCOPE,
  DetailFlag,
  ElectricianProblem,
  type Estimate,
  EstimateRequest,
  hoursBand,
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

/** The estimate request for a job of `trade` in `city` with these details; undefined only if it fails the schema. */
export function estimateRequest(city: City, trade: Trade, details: Details = {}): EstimateRequest | undefined {
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
  return EstimateRequest.safeParse({ city, trade, scope: scopes[trade] }).data;
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

/** How many pages an estimate rests on: a page quoted twice counts once. */
export const sourceCount = (estimate: Estimate): number => new Set(estimate.basis.sources.map((s) => s.url)).size;
