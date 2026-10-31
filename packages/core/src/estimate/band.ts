import { type Estimate, QuestionKey, type RateBand, ScopeKind, type ScopeRule, Trade } from "@gigsync/protocol";
import { SCOPE_KEYS } from "./scope.js";

/** Coats an estimate's painting price is for: the usual primer-and-finish job. */
const COATS_INCLUDED = 2;
/**
 * Each coat past that repeats the last coat's labour and paint, roughly a fifth of a two-coat job. Our assumption, not
 * a sourced rate: no quote we found prices coats separately. Count rules never cut, so one coat costs the same.
 */
const PERCENT_PER_COAT = 20;

/** Scope the agreed terms add (ADR 0033 §3): the price follows a term through these, never a number a model wrote. */
const TERM_RULES: Readonly<Partial<Record<Trade, readonly ScopeRule[]>>> = {
  [Trade.enum.painter]: [
    { kind: ScopeKind.enum.count, key: QuestionKey.enum.coats, percent: PERCENT_PER_COAT, included: COATS_INCLUDED },
  ],
};

/**
 * An estimate as the band the worker's agent plans a job from (ADR 0030, Consequences): the estimate's low and high
 * for this job's scope, in place of the city band, keeping the city band's scope rules only for details the
 * estimate's buckets did not already price (pets, say), and the rules the agreed terms add (coats).
 */
export function estimateBand(estimate: Estimate, trade: Trade, cityBand?: RateBand): RateBand {
  const priced = SCOPE_KEYS[trade];
  return {
    trade,
    low_paise: estimate.low_paise,
    high_paise: estimate.high_paise,
    scope: [...(cityBand?.scope ?? []).filter((rule) => !priced.includes(rule.key)), ...(TERM_RULES[trade] ?? [])],
  };
}
