import type { Estimate, RateBand, Trade } from "@gigsync/protocol";
import { SCOPE_KEYS } from "./scope.js";

/**
 * An estimate as the band the worker's agent plans a job from (ADR 0030, Consequences): the estimate's low and high
 * for this job's scope, in place of the city band, keeping the city band's scope rules only for details the
 * estimate's buckets did not already price (pets, say). No rules without a city band.
 */
export function estimateBand(estimate: Estimate, trade: Trade, cityBand?: RateBand): RateBand {
  const priced = SCOPE_KEYS[trade];
  return {
    trade,
    low_paise: estimate.low_paise,
    high_paise: estimate.high_paise,
    scope: (cityBand?.scope ?? []).filter((rule) => !priced.includes(rule.key)),
  };
}
