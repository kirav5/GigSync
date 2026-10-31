import { z } from "zod";
import { Trade } from "./trade.js";

/**
 * Terms of a job other than its price (ADR 0033 §3): when, who buys the materials, how many coats, how many hours a
 * day. Structured values only, never free text, so each phone validates every proposal and renders it in its own
 * owner's language. The agents propose and counter them inside `quote` and `counter`; both owners see the agreed
 * terms when they sign, and the terms hash covers them.
 */

/**
 * The device capability number that understands terms. A phone below it would drop the terms from an offer it
 * parses and hash different terms when signing, so terms travel only when every device of the other side reports
 * this number. Includes MENTOR_PROTOCOL (4) and everything before it.
 */
export const TERMS_PROTOCOL = 5;

/** Part of the day the work happens in. */
export const TimeWindow = z.enum(["morning", "afternoon", "evening"]);
export type TimeWindow = z.infer<typeof TimeWindow>;

/** Who buys the paint, wood or parts. */
export const MaterialsBy = z.enum(["worker", "household"]);
export type MaterialsBy = z.infer<typeof MaterialsBy>;

/** The terms the agents negotiate, by name. */
export const TermKey = z.enum(["when", "materials", "coats", "hours"]);
export type TermKey = z.infer<typeof TermKey>;

/** `when.day` for work that recurs every day (a cook, a maid): only the window is agreed. */
export const EVERY_DAY = "daily";
export const MIN_COATS = 1;
export const MAX_COATS = 3;
export const MIN_HOURS = 1;
export const MAX_HOURS = 12;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A day ("YYYY-MM-DD", or `EVERY_DAY`) and the part of it. */
export const TermWhen = z.object({
  day: z.union([z.string().regex(ISO_DAY, "iso day"), z.literal(EVERY_DAY)]),
  window: TimeWindow,
});
export type TermWhen = z.infer<typeof TermWhen>;

/** One side's proposal, or the agreed terms. Every field is optional: a term nobody raised is not part of the deal. */
export const Terms = z.object({
  when: TermWhen.optional(),
  materials: MaterialsBy.optional(),
  coats: z.number().int().min(MIN_COATS).max(MAX_COATS).optional(),
  hours: z.number().int().min(MIN_HOURS).max(MAX_HOURS).optional(),
});
export type Terms = z.infer<typeof Terms>;

const T = Trade.enum;
const K = TermKey.enum;

/** The terms each trade negotiates; a term outside its trade's list is never part of a deal. */
export const TRADE_TERMS: Readonly<Record<Trade, readonly TermKey[]>> = {
  [T.electrician]: [K.when],
  [T.plumber]: [K.when],
  [T.ac_technician]: [K.when],
  [T.carpenter]: [K.when, K.materials],
  [T.painter]: [K.when, K.materials, K.coats],
  [T.maid]: [K.when, K.hours],
  [T.cook]: [K.when, K.hours],
  [T.driver]: [K.when, K.hours],
};

/** Every term set in `terms` is one the trade negotiates. */
export const termsFit = (trade: Trade, terms: Terms): boolean =>
  TermKey.options.every((key) => terms[key] === undefined || TRADE_TERMS[trade].includes(key));

/** Only the terms the trade negotiates, for a proposal that came with others. */
export const fitTerms = (trade: Trade, terms: Terms): Terms =>
  Terms.parse(Object.fromEntries(TRADE_TERMS[trade].map((key) => [key, terms[key]])));
