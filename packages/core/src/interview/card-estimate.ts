import { RateUnit } from "@gigsync/protocol";
import { suggestForWorker, type WorkerSuggestion } from "../estimate/suggest.js";
import type { InterviewState, Prompt } from "./card.js";
import { askingArrangement } from "./card-arrangements.js";
import { estimateLines, type FoundEstimate, suggestion } from "./estimate-lines.js";

/**
 * The estimate under the card's rate questions (ADR 0030 §5): for the worker's first trade at the trade's default
 * scope, in place of the city band when there is one. The amounts are suggestions: a chip uses one, and the worker
 * can say their own instead, which is checked like any other amount.
 */

/** The interview with the estimate the app found for a trade, or without one (none, or offline). */
export const withEstimate = (state: InterviewState, found: FoundEstimate | undefined): InterviewState => ({
  ...state,
  estimate: found,
});

/**
 * A card prices one-off work per visit: it asks "How much do you usually take for one visit?" and reads "₹600 a
 * visit". An estimate for the whole job is that one visit's price, so the card chat says it in the same unit.
 */
const perVisit = (found: FoundEstimate): FoundEstimate =>
  found.estimate.unit === RateUnit.enum.job
    ? { ...found, estimate: { ...found.estimate, unit: RateUnit.enum.visit } }
    : found;

/**
 * The estimate, only while it is for the worker's first trade (a trade changed since has none until it arrives), in
 * the unit the card asks for.
 */
export function cardEstimate(state: InterviewState): FoundEstimate | undefined {
  const found = state.estimate;
  const sameWork = found?.request.arrangement === askingArrangement(state);
  return found && found.request.trade === state.draft.trades?.[0] && sameWork ? perVisit(found) : undefined;
}

/** What the estimate suggests the worker opens at and takes at least, when it fits. */
export function workerSuggestion(state: InterviewState): WorkerSuggestion | undefined {
  const found = cardEstimate(state);
  if (!found) return undefined;
  return suggestForWorker({ estimate: found.estimate, trade: found.request.trade, city: found.request.city });
}

/**
 * Under the rate for another arrangement: the range with what it rests on and the opening suggested. Undefined when
 * there is no estimate for the work. The usual rate and the lowest show the price cards instead (`card-price.ts`).
 */
export function estimatePrompt(state: InterviewState): Omit<Prompt, "hints"> | undefined {
  const found = cardEstimate(state);
  const suggested = workerSuggestion(state);
  if (!found || !suggested) return undefined;
  const tip = suggestion("estimate.suggest_rate", suggested.opening_paise);
  return { lines: [...estimateLines(state.config.own, found), tip.line], choices: [tip.choice] };
}

/** The amount suggested for the question now asked: the opening, or with `least` the lowest; none without an estimate. */
export function suggestedAmount(state: InterviewState, least: boolean): number | undefined {
  const suggested = workerSuggestion(state);
  return suggested && (least ? suggested.limit_paise : suggested.opening_paise);
}
