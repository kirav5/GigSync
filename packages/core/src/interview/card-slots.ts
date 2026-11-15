import type { Field } from "./lexicon.js";

/** The card interview's questions, by name, and the values its tap choices carry. */

/** Where the interview is: the field being asked, then confirm, then done. */
export const Slot = {
  trade: "trade",
  /** The other kinds of work in the same group, to tick (ADR 0061). */
  also: "also",
  /** Which arrangements a maid or driver takes (ADR 0046). */
  arrangements: "arrangements",
  area: "area",
  rate: "rate",
  min: "min",
  /** The usual rate for each other arrangement picked. */
  more_rates: "more_rates",
  /** "The same price for all your work?" for a card with more than one kind (ADR 0062). */
  same_rate: "same_rate",
  /** The usual rate for each other kind, after a no to that. */
  work_rate: "work_rate",
  languages: "languages",
  about: "about",
  ask_first: "ask_first",
  /** What the worker needs to know before quoting (ADR 0063). */
  asks: "asks",
  auto: "auto",
  /** Asked only when the owner wants them changed: a first card stays as short as it was (ADR 0053 §7). */
  hours: "hours",
  hours_to: "hours_to",
  days: "days",
  radius: "radius",
  materials: "materials",
  max_hours: "max_hours",
  /** Which of several rates to change. */
  which_rate: "which_rate",
  /** "Take your card off the board?" */
  unlist: "unlist",
  confirm: "confirm",
  done: "done",
  /** Said yes to taking the card off the board. */
  unlisted: "unlisted",
} as const;
export type Slot = (typeof Slot)[keyof typeof Slot];

/** The values tap choices carry besides trades, areas, languages and fields. */
export const Pick = { yes: "yes", no: "no", none: "none", skip: "skip", suggested: "suggested", any: "any" } as const;

/** The fields an owner can change from confirm, in the order the chips show them. */
export const FIELDS: readonly Field[] = [
  Slot.trade,
  Slot.arrangements,
  Slot.area,
  Slot.radius,
  Slot.rate,
  Slot.min,
  Slot.same_rate,
  Slot.hours,
  Slot.days,
  Slot.languages,
  Slot.about,
  Slot.ask_first,
  Slot.asks,
  Slot.materials,
  Slot.max_hours,
  Slot.auto,
  Slot.unlist,
];
