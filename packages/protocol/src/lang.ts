import { z } from "zod";

/**
 * Languages a phone can render the job in, as BCP 47 primary subtags. What travels between phones is structure
 * (keys, codes, paise), so a worker and a consumer never need a common language; each phone renders keys from its
 * own strings. Adding a language is a new value here plus its strings in `@gigsync/core` (HLD 7.6, LLD 9).
 */
export const Lang = z.enum(["en", "hi", "kn"]);
export type Lang = z.infer<typeof Lang>;

/** The language assumed for text from a sender that did not say, and the last step of every fallback chain. */
export const DEFAULT_LANG: Lang = Lang.enum.en;

/**
 * What the worker's agent may ask before quoting. Keys only: the receiving phone shows each in its owner's language,
 * so a Hindi-speaking worker's agent can ask a Kannada-speaking household and both read it natively.
 */
export const QuestionKey = z.enum([
  "problem",
  "rooms",
  "area_sqft",
  "people",
  "meals",
  "pets",
  "route",
  /** Painting: "yes" when the household buys the paint (a `DetailFlag`). */
  "labour_only",
  /** A maid's visits: a `MaidFrequency` value. */
  "frequency",
  /** A driver's hours a day, as a number. */
  "hours",
  /** Painting: coats of paint, as a number; set from the agreed terms, never asked as a standard question. */
  "coats",
  /** ADR 0041's price drivers, as request details carry them: a driver's enum value or count, never words. */
  "surface",
  "floors",
  "house_type",
  "finish",
  "days_week",
  "tasks",
  "vehicle",
  "points",
  /** How long the work is for (ADR 0046): an `Arrangement` value, for the trades priced by arrangement. */
  "arrangement",
]);
export type QuestionKey = z.infer<typeof QuestionKey>;

/**
 * The value a consumer's app writes for a yes-or-no detail (a toggle, never typed), so rules and prices can read it
 * without guessing at free text in any language.
 */
export const DetailFlag = z.enum(["yes", "no"]);
export type DetailFlag = z.infer<typeof DetailFlag>;
