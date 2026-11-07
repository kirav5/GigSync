import { type Estimate, type PlaceKey, RateUnit, Role, type Trade } from "@gigsync/protocol";
import { LEGAL_MINIMUM, type LegalMinimum } from "../job/city-rates.js";
import { PRICE_STEP_PAISE } from "../job/negotiate.js";
import { MONTHLY_TRADES } from "../job/when.js";

/**
 * What an estimate suggests to each side, never decides: the worker an opening price and a least-I'll-take, the
 * household a budget. The owner confirms or changes each one; their own limit stays theirs and stays on the phone
 * (ADR 0030 §5). Plain arithmetic on the estimate's figures, the same for everyone.
 */

const R = Role.enum;

/** The worker's suggested opening price and least-I'll-take, in paise. */
export interface WorkerSuggestion {
  opening_paise: number;
  limit_paise: number;
}

/** The household's suggested budget, in paise. */
export interface HouseholdSuggestion {
  budget_paise: number;
}

/** An estimate with the trade and city it is for. */
export interface EstimatedJob {
  estimate: Estimate;
  trade: Trade;
  city: PlaceKey;
}

const roundUp = (paise: number) => Math.ceil(Math.round(paise) / PRICE_STEP_PAISE) * PRICE_STEP_PAISE;

/**
 * The legal minimum in the estimate's unit: the floor the server applied, or, for a monthly figure in the law's city,
 * the state's monthly minimum for the trade pro-rated as `city-rates.ts` explains, whichever is higher. Zero when
 * no law is known for this trade, city and unit.
 */
export function legalFloor(job: EstimatedJob, law: LegalMinimum = LEGAL_MINIMUM): number {
  const { estimate, trade, city } = job;
  const server = estimate.basis.legal_minimum_paise ?? 0;
  const day = law.trades[trade];
  const sameCity = law.city.toLowerCase() === city;
  if (!day || !sameCity || estimate.unit !== RateUnit.enum.month || !MONTHLY_TRADES.has(trade)) return server;
  const monthly = (day.day_paise * day.hours * law.days_per_month) / law.day_hours;
  return Math.max(server, roundUp(monthly));
}

/**
 * The worker opens at the usual price (the estimate's typical figure, rounded up to ₹10) and is offered the low end
 * as the least they take, never below the legal minimum: prices accepted under pressure cannot drag a suggestion
 * below the law. The opening is never below that least.
 */
export function suggestForWorker(job: EstimatedJob, law?: LegalMinimum): WorkerSuggestion {
  const { estimate } = job;
  const floor = legalFloor(job, law);
  const limit = roundUp(Math.max(estimate.low_paise, floor));
  return { opening_paise: Math.max(limit, roundUp(estimate.typical_paise)), limit_paise: limit };
}

/** The household is offered the usual price as its budget, never below the legal minimum the worker is owed. */
export function suggestForHousehold(job: EstimatedJob, law?: LegalMinimum): HouseholdSuggestion {
  return { budget_paise: roundUp(Math.max(job.estimate.typical_paise, legalFloor(job, law))) };
}

/** `suggestForWorker` for the provider, `suggestForHousehold` for the requester. */
export function suggestFromEstimate(
  job: EstimatedJob,
  role: Role,
  law?: LegalMinimum,
): WorkerSuggestion | HouseholdSuggestion {
  return role === R.provider ? suggestForWorker(job, law) : suggestForHousehold(job, law);
}
