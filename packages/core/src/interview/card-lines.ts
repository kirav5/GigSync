import type { MessageKey } from "../i18n/t.js";

/** What an interview shows: its lines, its tap choices and what the answer is expected to be. */

/**
 * One line the app shows (and reads aloud unless `silent`). `prices` are paise, formatted by the app with `money()`.
 * `names` are catalog keys (trades, an area, a language), put in whatever language the reader has when the line is
 * shown, several joined with commas: a line stays in one language even if the owner switches mid-interview.
 */
export interface Line {
  key: MessageKey;
  params?: Record<string, string | number>;
  prices?: Record<string, number>;
  names?: Readonly<Record<string, readonly MessageKey[]>>;
  /** Days as "YYYY-MM-DD", written as a date in the reader's language when shown. */
  dates?: Readonly<Record<string, string>>;
  silent?: true;
}

/** A tap answer: the value `choose()` takes, and the label shown. */
export interface Choice {
  value: string;
  key: MessageKey;
  params?: Record<string, string | number>;
}

/** What to show now: lines, the tap choices, whether the answer is an amount, and words the recognizer should expect. */
export interface Prompt {
  lines: Line[];
  choices?: readonly Choice[];
  numeric?: boolean;
  hints: string[];
  /**
   * The answer is private (the lowest rate): only a recognizer on the phone itself may hear it, never a company's,
   * whatever the owner allowed for the other questions. Typing and the tap choices still work.
   */
  secret?: true;
  /**
   * The choices toggle: tapping one turns it on or off in place, and only the choice that says Done answers. These are
   * the values on now.
   */
  picked?: readonly string[];
}
