import { LEGAL_MINIMUM } from "@gigsync/core";
import {
  DetailFlag,
  type EstimateRequest,
  hoursBand,
  type MaidFrequency,
  mealsBucket,
  peopleBand,
  type QuoteCovers,
  RateUnit,
  roomsBucket,
  Trade,
} from "@gigsync/protocol";
import { WEEKS_PER_MONTH } from "./constants.js";
import { type CheckedQuote, DropReason } from "./verify.js";

const U = RateUnit.enum;
const T = Trade.enum;

/** What an estimate for this request is priced per: a month of household work, a repair job, a painting job or sq ft. */
export function estimateUnit(req: EstimateRequest): RateUnit {
  switch (req.trade) {
    case T.painter:
      return req.scope.rooms ? U.job : U.sqft;
    case T.maid:
    case T.cook:
    case T.driver:
      return U.month;
    default:
      return U.job;
  }
}

/** Working days a month: the usual conversion of a day rate to a monthly wage, as the legal minimum uses it. */
const DAYS_PER_MONTH = LEGAL_MINIMUM.days_per_month;
const MAID_VISITS: Readonly<Record<MaidFrequency, number>> = {
  daily: DAYS_PER_MONTH,
  alternate_days: DAYS_PER_MONTH / 2,
  weekly: WEEKS_PER_MONTH,
};

/** Days of work in a month for a monthly job: every working day, except a maid who comes less often. */
export const visitsPerMonth = (req: EstimateRequest): number =>
  req.trade === T.maid ? MAID_VISITS[req.scope.frequency] : DAYS_PER_MONTH;

const positive = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n) && n > 0;

/** A per-day, per-visit or per-hour price as a month of the request's days; undefined when it cannot be. */
function perMonth(q: CheckedQuote, req: EstimateRequest): number | undefined {
  const days = visitsPerMonth(req);
  if (q.unit === U.day || q.unit === U.visit) return q.amount_rupees * days;
  if (q.unit === U.hour && positive(q.covers.hours)) return q.amount_rupees * q.covers.hours * days;
  return undefined;
}

/** A painting price per sq ft or per day as a whole job, when the quote says the area or the days. */
function paintingJob(q: CheckedQuote): number | undefined {
  const { area_sqft, days } = q.covers;
  if (q.unit === U.sqft && positive(area_sqft)) return q.amount_rupees * area_sqft;
  if (q.unit === U.day && positive(days)) return q.amount_rupees * days;
  return undefined;
}

function convert(q: CheckedQuote, req: EstimateRequest, target: RateUnit): number | undefined {
  if (q.unit === target) return q.amount_rupees;
  if (target === U.month) return perMonth(q, req);
  if (target === U.sqft)
    return q.unit === U.job && positive(q.covers.area_sqft) ? q.amount_rupees / q.covers.area_sqft : undefined;
  return req.trade === T.painter ? paintingJob(q) : undefined;
}

/** An unstated detail passes; a stated one must fall in the request's bucket. */
const fits = <B>(stated: number | undefined, bucket: (n: number) => B, wanted: B) =>
  stated === undefined || bucket(stated) === wanted;

/**
 * Whether what a quote covers matches the request's buckets. Painting is strict, because paint and size move its price
 * most: the quote must say whether materials are included, and a whole-job quote must say the bedrooms. Elsewhere a
 * detail the page does not state passes.
 */
function coversFit(c: QuoteCovers, req: EstimateRequest): boolean {
  switch (req.trade) {
    case T.painter: {
      const materials = req.scope.labour_only === DetailFlag.enum.no;
      if (c.materials_included !== materials) return false;
      const rooms = req.scope.rooms;
      return rooms === undefined || (c.rooms !== undefined && roomsBucket(c.rooms) === rooms);
    }
    case T.maid:
      return fits(c.rooms, roomsBucket, req.scope.rooms);
    case T.cook:
      return fits(c.people, peopleBand, req.scope.people) && fits(c.meals, mealsBucket, req.scope.meals);
    case T.driver:
      return fits(c.hours, hoursBand, req.scope.hours);
    default:
      return true;
  }
}

/**
 * A checked quote in the request's unit and scope, in rupees: per sq ft × area, per day × days, per hour × hours ×
 * days, or as written when the units match. Dropped when it cannot be converted or covers a different job.
 */
export function inRequestUnit(q: CheckedQuote, req: EstimateRequest): number | DropReason {
  const amount = convert(q, req, estimateUnit(req));
  if (amount === undefined) return DropReason.unitMismatch;
  return coversFit(q.covers, req) ? amount : DropReason.scopeMismatch;
}
