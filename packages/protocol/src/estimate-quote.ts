import { z } from "zod";
import { RateUnit } from "./estimate.js";

/**
 * What the server's model returns when it reads web pages for an estimate (ADR 0030 §2): prices written on the pages,
 * each with its sentence, page and what it covers. Server-only. The model never estimates; code checks every quote
 * against the fetched page and computes the range. Kept loose on purpose (no length or range limits): the model's
 * output format cannot express them, and one bad quote must be dropped by the checks, not fail the whole answer.
 */

/** What a quoted price includes, as far as its sentence or page says. Unstated details are left out. */
export const QuoteCovers = z.object({
  area_sqft: z.number().optional(),
  rooms: z.number().optional(),
  people: z.number().optional(),
  meals: z.number().optional(),
  materials_included: z.boolean().optional(),
  /** Hours of work a day (or per visit) the price is for. */
  hours: z.number().optional(),
  /** Days of work a whole-job price is for, or the price per day multiplies by. */
  days: z.number().optional(),
});
export type QuoteCovers = z.infer<typeof QuoteCovers>;

export const ExtractedQuote = z.object({
  url: z.string(),
  /** The sentence the price is in, copied exactly from the page. */
  sentence: z.string(),
  amount_rupees: z.number(),
  unit: RateUnit,
  covers: QuoteCovers,
  site: z.string(),
});
export type ExtractedQuote = z.infer<typeof ExtractedQuote>;

export const QuoteExtraction = z.object({ quotes: z.array(ExtractedQuote) });
export type QuoteExtraction = z.infer<typeof QuoteExtraction>;
