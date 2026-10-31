import { type Estimate, type EstimateRequest, type Lang, RateUnit, Trade } from "@gigsync/protocol";
import { areaOfSlug } from "../estimate/areas.js";
import { priceText } from "../i18n/reasons.js";
import { type MessageKey, pluralKey, t } from "../i18n/t.js";
import { type Choice, type Line, Pick } from "./card.js";
import { isMessageKey } from "./choices.js";
import { blendLine, driverLines } from "./estimate-drivers.js";

/**
 * An estimate as the interviews show it (ADR 0039, ADR 0041): the range for the job's scope, what it rests on (how
 * many jobs on GigSync and where, and the city's rate card), the legal minimum, and the amount suggested, which the owner taps to use or says their own. Every figure is the estimate's own; nothing here computes
 * a price.
 */

/** An estimate with the request it answers, so a screen can tell whether it still fits the job as it now stands. */
export interface FoundEstimate {
  request: EstimateRequest;
  estimate: Estimate;
}

const RANGE: Readonly<Record<RateUnit, MessageKey>> = {
  [RateUnit.enum.job]: "estimate.range_job",
  [RateUnit.enum.month]: "estimate.range_month",
  [RateUnit.enum.visit]: "estimate.range_visit",
  [RateUnit.enum.day]: "estimate.range_day",
  [RateUnit.enum.hour]: "estimate.range_hour",
  [RateUnit.enum.sqft]: "estimate.range_sqft",
};
const OTHER_PROBLEM = "other";
const T = Trade.enum;

/** The scope's buckets in the reader's words: "2 BHK, labour only", "3–4 people, 2 meals a day". */
function scopeParts(own: Lang, request: EstimateRequest): string[] {
  const keys: MessageKey[] = [];
  switch (request.trade) {
    case T.painter:
      if (request.scope.rooms) keys.push(`estimate.rooms.${request.scope.rooms}`);
      keys.push(`estimate.labour.${request.scope.labour_only}`);
      break;
    case T.maid:
      keys.push(`estimate.rooms.${request.scope.rooms}`, `estimate.frequency.${request.scope.frequency}`);
      break;
    case T.cook:
      keys.push(`estimate.people.${request.scope.people}`, `estimate.meals.${request.scope.meals}`);
      break;
    case T.driver:
      keys.push(`estimate.hours.${request.scope.hours}`);
      break;
    default:
      if (request.scope.problem !== OTHER_PROBLEM) keys.push(`estimate.problem.${request.scope.problem}`);
  }
  return keys.map((k) => t(own, k));
}

/** Where the range is for: the area its GigSync jobs are in, else the city. */
function placeKeys({ request, estimate }: FoundEstimate): MessageKey[] {
  const area = estimate.basis.area && areaOfSlug(estimate.basis.area);
  const key = area ? `area.${area.key}` : `city.${request.city}`;
  return isMessageKey(key) ? [key] : [];
}

/** What the range rests on: every source it blends, or, for a range from before the blend, GigSync's jobs and where. */
function basisLine(own: Lang, found: FoundEstimate, place: readonly MessageKey[]): Line {
  const { estimate } = found;
  if (estimate.basis.blend) return blendLine(own, found.request, estimate);
  const jobs = estimate.basis.gigsync_jobs;
  return { key: pluralKey(own, "estimate.jobs", jobs), params: { count: jobs }, names: { place } };
}

/** The range with its scope and place, then what it rests on, and the legal minimum if known. */
export function estimateLines(own: Lang, found: FoundEstimate): Line[] {
  const { request, estimate } = found;
  const parts = scopeParts(own, request);
  const place = placeKeys(found);
  return [
    {
      key: RANGE[estimate.unit],
      names: { trade: [`trade.${request.trade}`], ...(place.length > 0 ? { city: place } : {}) },
      params: { scope: parts.length > 0 ? t(own, "estimate.scope", { scope: parts.join(", ") }) : "" },
      prices: { low: estimate.low_paise, high: estimate.high_paise },
    },
    basisLine(own, found, place),
    ...driverLines(estimate),
    ...estimateLegalLines(found),
  ];
}

/** The legal minimum the estimate was floored at, as a line, when one is known. */
export function estimateLegalLines({ estimate }: FoundEstimate): Line[] {
  const law = estimate.basis.legal_minimum_paise;
  return law ? [{ key: "estimate.legal_min", prices: { min: law } }] : [];
}

/** The amount suggested, said under the question, and the chip that uses it. */
export function suggestion(key: MessageKey, paise: number): { line: Line; choice: Choice } {
  return {
    line: { key, prices: { price: paise } },
    choice: { value: Pick.suggested, key: "estimate.use", params: { price: priceText(paise) } },
  };
}
