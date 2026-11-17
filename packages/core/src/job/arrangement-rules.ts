import {
  type Arrangement,
  type ArrangementRate,
  DEFAULT_ARRANGEMENT,
  hasArrangements,
  isTrade,
  type JobRequest,
  type Skill,
  type Trade,
} from "@gigsync/protocol";
import { arrangementIn } from "../estimate/scope.js";
import type { Mandate } from "./negotiate.js";
import { atShare, type WorkMandate, workMandate } from "./work-rates.js";

/**
 * A worker's rates by arrangement (ADR 0046): which of hourly, one visit, weekly and monthly work they take, and their
 * usual and lowest rate for each. A worker with none set takes monthly work only, at their card's rate, as before.
 */

/** One arrangement a worker takes, with its plan: the usual rate (public) and the lowest (never leaves the phone). */
export interface ArrangementMandate {
  arrangement: Arrangement;
  rate: Mandate;
}

/** What the worker's rules hold for arrangements: absent for every trade priced the old way. */
export interface ArrangementRules {
  rate: Mandate;
  arrangements?: readonly ArrangementMandate[] | undefined;
  /** ADR 0062: the kinds with a plan of their own, and the card's work to find a request's kind in. */
  work_rates?: readonly WorkMandate[] | undefined;
  trades?: readonly Trade[] | undefined;
  skills?: readonly Skill[] | undefined;
}

type Asked = Pick<JobRequest, "trade" | "details"> & Partial<Pick<JobRequest, "skill">>;

/** The arrangement a request asks for: its detail, monthly when it names none. */
export const askedArrangement = (request: Pick<JobRequest, "trade" | "details">): Arrangement =>
  arrangementIn(request.trade, request.details) ?? DEFAULT_ARRANGEMENT;

/**
 * The worker's plan for a request's arrangement; undefined when they do not take that arrangement. A card that names
 * no arrangements takes monthly work only for a trade (ADR 0046), and any arrangement for work outside the trades,
 * whose card never named one before ADR 0051.
 */
export function arrangementMandate(rules: ArrangementRules, request: Asked): Mandate | undefined {
  // A kind with a rate of its own is priced by it (ADR 0062); arrangements are for the card's first kind.
  const own = workMandate(rules, request);
  if (own) return own;
  if (!hasArrangements(request.trade)) return rules.rate;
  const asked = askedArrangement(request);
  if (!rules.arrangements?.length)
    return asked === DEFAULT_ARRANGEMENT || !isTrade(request.trade) ? rules.rate : undefined;
  return rules.arrangements.find((a) => a.arrangement === asked)?.rate;
}

/** The worker's plan for the request: its arrangement's, or their card's rate when no other fits. */
export const rateFor = (rules: ArrangementRules, request: Asked): Mandate =>
  arrangementMandate(rules, request) ?? rules.rate;

/**
 * The plans for the arrangements a worker picked: the main one at its rate and lowest, each other at its own rate
 * with the lowest at the same share of it, rounded to the rupee (ADR 0046 §2).
 */
export function arrangementMandates(
  rates: readonly ArrangementRate[],
  main: Mandate,
  mainArrangement: Arrangement,
): ArrangementMandate[] {
  return rates.map(({ arrangement, rate_paise }) => ({
    arrangement,
    rate: arrangement === mainArrangement ? main : atShare(rate_paise, main),
  }));
}
