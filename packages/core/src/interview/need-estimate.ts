import type { City, EstimateRequest } from "@gigsync/protocol";
import { areaSlug } from "../estimate/areas.js";
import { estimateRequest, sameRequest } from "../estimate/scope.js";
import { suggestForHousehold } from "../estimate/suggest.js";
import type { Prompt } from "./card.js";
import { estimateLines, type FoundEstimate, suggestion } from "./estimate-lines.js";
import type { NeedDraft, NeedState } from "./need.js";
import { draftDetails } from "./need-request.js";

/**
 * The estimate beside the household's budget question (ADR 0030 §5): the range for the job as described so far, with
 * its sources, and the budget it suggests, which the owner taps to use or answers with their own. Never filled in
 * silently: the budget stays the owner's, and stays on the phone. Not asked while scope read from the owner's words
 * waits for them to confirm it.
 */

/** What the estimate is asked for: the details the chat gathered (the first question's answer, and counts said). */
export const needDetails = (d: NeedDraft): Record<string, string> => ({ ...d.seen, ...draftDetails(d) });

/** The request for this need's estimate in `city`, and in its area once that is known, once the trade is known. */
export const needRequest = (city: City, d: NeedDraft): EstimateRequest | undefined =>
  d.trade && (!d.scope || d.scope.confirmed)
    ? estimateRequest(city, d.trade, needDetails(d), d.area ? areaSlug(d.area) : undefined)
    : undefined;

/** The need with the estimate the app found for it, or without one. */
export const needWithEstimate = (s: NeedState, found: FoundEstimate | undefined): NeedState => ({
  ...s,
  estimate: found,
});

/** The estimate, only while it is for the job as now described: a changed trade or detail has none until it comes. */
export function needEstimate(s: NeedState): FoundEstimate | undefined {
  const found = s.estimate;
  return found && sameRequest(found.request, needRequest(found.request.city, s.draft)) ? found : undefined;
}

/** The budget the estimate suggests; undefined without a fitting estimate. */
export function suggestedBudget(s: NeedState): number | undefined {
  const found = needEstimate(s);
  if (!found) return undefined;
  const { estimate, request } = found;
  return suggestForHousehold({ estimate, trade: request.trade, city: request.city }).budget_paise;
}

/** Beside the budget question: the range, its sources and the budget suggested; undefined without an estimate. */
export function budgetEstimate(s: NeedState): Pick<Prompt, "lines" | "choices" | "sources"> | undefined {
  const found = needEstimate(s);
  const budget = suggestedBudget(s);
  if (!found || budget === undefined) return undefined;
  const tip = suggestion("estimate.suggest_budget", budget);
  return {
    lines: [...estimateLines(s.config.own, found), tip.line],
    choices: [tip.choice],
    sources: found.estimate.basis.sources,
  };
}
