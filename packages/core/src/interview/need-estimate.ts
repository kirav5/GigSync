import type { City, EstimateRequest } from "@gigsync/protocol";
import { areaSlug } from "../estimate/areas.js";
import { estimateRequest, sameRequest } from "../estimate/scope.js";
import { suggestForHousehold } from "../estimate/suggest.js";
import type { Prompt } from "./card.js";
import { draftDrivers, priceOpen } from "./driver-ask.js";
import { estimateLines, type FoundEstimate, suggestion } from "./estimate-lines.js";
import type { NeedDraft, NeedState } from "./need.js";
import { draftDetails } from "./need-request.js";

/**
 * The estimate beside the household's budget question (ADR 0030 §5): the range for the job as described so far, with
 * what it rests on, and the budget it suggests, which the owner taps to use or answers with their own. Never filled in
 * silently: the budget stays the owner's, and stays on the phone. Not asked while scope read from the owner's words
 * waits for them to confirm it.
 */

/** What the estimate is asked for: the details the chat gathered (the first question's answer, and counts said). */
export const needDetails = (d: NeedDraft): Record<string, string> => ({ ...d.seen, ...draftDetails(d) });

/**
 * The request for this need's estimate in `city`, with its price drivers, once the job is described: the trade known,
 * the scope confirmed, the driver questions done and the area answered. Not before, so a job sends one estimate
 * request, after the last answer, never one per answer (the server may ask a model for it).
 */
export function needRequest(city: City, d: NeedDraft): EstimateRequest | undefined {
  if (!d.trade || (d.scope && !d.scope.confirmed) || d.area === undefined || priceOpen(d)) return undefined;
  // Structured drivers only: facts the phone's model gathered stay on the phone (founders, 2026-10-31).
  return estimateRequest(city, d.trade, needDetails(d), areaSlug(d.area), draftDrivers(d));
}

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

/** Beside the budget question: the range, what it rests on and the budget suggested; undefined without an estimate. */
export function budgetEstimate(s: NeedState): Pick<Prompt, "lines" | "choices"> | undefined {
  const found = needEstimate(s);
  const budget = suggestedBudget(s);
  if (!found || budget === undefined) return undefined;
  const tip = suggestion("estimate.suggest_budget", budget);
  return { lines: [...estimateLines(s.config.own, found), tip.line], choices: [tip.choice] };
}
