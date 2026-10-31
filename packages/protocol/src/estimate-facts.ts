import { z } from "zod";

/**
 * Extra facts and job types (ADR 0041, as extended by the founders on 2026-10-31). On a phone with a usable model, the
 * model may ask a few questions beyond the fixed drivers and turn the answers into short labelled facts; a need outside
 * GigSync's trades carries a short job type instead of a trade. Both are model output from the owner's words, so the
 * phone scrubs them first (no phone numbers, nothing that looks like an address). Both stay on the phone: no estimate
 * request carries them.
 */

export const MAX_FACTS = 5;
export const MAX_FACT_LABEL = 40;
export const MAX_FACT_VALUE = 80;
export const MAX_JOB_TYPE = 40;
const MIN_JOB_TYPE = 2;

/** One fact: "Wall condition" → "damp patches in two rooms". */
export const EstimateFact = z.strictObject({
  label: z.string().trim().min(1).max(MAX_FACT_LABEL),
  value: z.string().trim().min(1).max(MAX_FACT_VALUE),
});
export type EstimateFact = z.infer<typeof EstimateFact>;

/** A job outside the trades, as a short label: "wedding photographer", "home tutor for class 8". */
export const JobType = z.string().trim().min(MIN_JOB_TYPE).max(MAX_JOB_TYPE);
