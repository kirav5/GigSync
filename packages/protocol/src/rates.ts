import { z } from "zod";
import { Trade } from "./job.js";
import { QuestionKey } from "./lang.js";
import { Paise } from "./payment.js";

/**
 * A city's going rates, as the city pack carries them (ADR 0016 §2): signed data, authored with the union, seeded from
 * its rate card until there are enough countersigned records to aggregate. The worker's agent proposes a price plan
 * from it with plain arithmetic; no model ever produces a number (HLD §3, agent-flows §1.1).
 */

export const MAX_SCOPE_PERCENT = 100;
export const MIN_SCOPE_PERCENT = -50;
const MAX_SCOPE_RULES = 10;
const MAX_BANDS = 50;
const MAX_INCLUDED = 50;

/** How a scope rule reads a detail: present or not, or a count beyond what the band already includes. */
export const ScopeKind = z.enum(["flag", "count"]);
export type ScopeKind = z.infer<typeof ScopeKind>;

const percent = z.number().int().min(MIN_SCOPE_PERCENT).max(MAX_SCOPE_PERCENT);

/** A change to the band for one detail of the job, e.g. +15% when there are pets, +10% per person beyond two. */
export const ScopeRule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(ScopeKind.enum.flag), key: QuestionKey, percent }),
  z.object({
    kind: z.literal(ScopeKind.enum.count),
    key: QuestionKey,
    percent,
    /** How many the band's price already covers. */
    included: z.number().int().min(0).max(MAX_INCLUDED),
  }),
]);
export type ScopeRule = z.infer<typeof ScopeRule>;

/** The usual range for one trade in the city, for the band's standard scope. */
export const RateBand = z
  .object({
    trade: Trade,
    low_paise: Paise,
    high_paise: Paise,
    scope: z.array(ScopeRule).max(MAX_SCOPE_RULES).default([]),
  })
  .refine((b) => b.low_paise <= b.high_paise, "low above high");
export type RateBand = z.infer<typeof RateBand>;

/** One city's bands, versioned so a phone can tell an old pack from a new one. */
export const RateCard = z.object({
  city: z.string().min(1).max(60),
  version: z.number().int().min(1),
  bands: z.array(RateBand).max(MAX_BANDS),
});
export type RateCard = z.infer<typeof RateCard>;
