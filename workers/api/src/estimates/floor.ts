import { estimateUnit, LEGAL_MINIMUM } from "@gigsync/core";
import { type EstimateRequest, type MaidFrequency, RateUnit, Trade } from "@gigsync/protocol";
import { ROUND_PAISE, WEEKS_PER_MONTH } from "./constants.js";
import { roundUpTo } from "./round.js";

/** Working days a month: the usual conversion of a day rate to a monthly wage, as the legal minimum uses it. */
const DAYS_PER_MONTH = LEGAL_MINIMUM.days_per_month;
const MAID_VISITS: Readonly<Record<MaidFrequency, number>> = {
  daily: DAYS_PER_MONTH,
  alternate_days: DAYS_PER_MONTH / 2,
  weekly: WEEKS_PER_MONTH,
};

/** Days of work in a month for a monthly job: every working day, except a maid who comes less often. */
const visitsPerMonth = (req: EstimateRequest): number =>
  req.trade === Trade.enum.maid ? MAID_VISITS[req.scope.frequency] : DAYS_PER_MONTH;

/**
 * The statutory floor for a monthly or hourly job, in paise, when the city's legal minimum covers the trade: the notified day
 * rate pro-rated to the hours the rate card assumes (`LEGAL_MINIMUM` in core's city-rates.ts), times the days a month
 * the job is worked. Rounded up to ₹10 so a figure is never shown below the law.
 */
export function legalFloorPaise(req: EstimateRequest): number | undefined {
  const rate = LEGAL_MINIMUM.trades[req.trade];
  if (!rate || req.city !== LEGAL_MINIMUM.city.toLowerCase()) return undefined;
  const unit = estimateUnit(req.trade, req.arrangement);
  // ADR 0046: an hour of work is floored at the notified day rate per hour; a visit or a week has no hours to count.
  if (unit === RateUnit.enum.hour) return roundUpTo(rate.day_paise / LEGAL_MINIMUM.day_hours, ROUND_PAISE);
  if (unit !== RateUnit.enum.month) return undefined;
  const perDay = (rate.day_paise * rate.hours) / LEGAL_MINIMUM.day_hours;
  return roundUpTo(perDay * visitsPerMonth(req), ROUND_PAISE);
}
