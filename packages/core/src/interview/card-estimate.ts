import { suggestForWorker, type WorkerSuggestion } from "../estimate/suggest.js";
import type { InterviewState, Prompt } from "./card.js";
import { estimateLegalLines, estimateLines, type FoundEstimate, suggestion } from "./estimate-lines.js";

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

/** The estimate, only while it is for the worker's first trade: a trade changed since has none until it arrives. */
export function cardEstimate(state: InterviewState): FoundEstimate | undefined {
  const found = state.estimate;
  return found && found.request.trade === state.draft.trades?.[0] ? found : undefined;
}

/** What the estimate suggests the worker opens at and takes at least, when it fits. */
export function workerSuggestion(state: InterviewState): WorkerSuggestion | undefined {
  const found = cardEstimate(state);
  if (!found) return undefined;
  return suggestForWorker({ estimate: found.estimate, trade: found.request.trade, city: found.request.city });
}

/**
 * Under the usual-rate question, the range with its sources and the opening suggested; under the least question,
 * asked right after, only the least suggested and the legal minimum, so the range is not heard twice in a row.
 * Undefined when there is no estimate for the trade: the city band shows instead.
 */
export function estimatePrompt(state: InterviewState, least: boolean): Omit<Prompt, "hints"> | undefined {
  const found = cardEstimate(state);
  const suggested = workerSuggestion(state);
  if (!found || !suggested) return undefined;
  const own = state.config.own;
  const tip = least
    ? suggestion("estimate.suggest_min", suggested.limit_paise)
    : suggestion("estimate.suggest_rate", suggested.opening_paise);
  const shown = least ? estimateLegalLines(found) : estimateLines(own, found);
  return {
    lines: [...shown, tip.line],
    choices: [tip.choice],
    ...(least ? {} : { sources: found.estimate.basis.sources }),
  };
}

/** The amount the suggestion chip stands for on the question now asked; undefined when it offers none. */
export function suggestedAmount(state: InterviewState, least: boolean): number | undefined {
  const suggested = workerSuggestion(state);
  return suggested && (least ? suggested.limit_paise : suggested.opening_paise);
}
