import type { Lang, QuestionKey, RateCard, Trade } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { NotBuiltError } from "../not-built.js";

/**
 * The card interview: one question at a time in the owner's language, answered by voice, typing or a tap, parsed by
 * word lists and an amount parser rather than a model ("models propose, code decides"). Pure: no platform calls, so
 * every step runs in vitest. Ends with a spoken summary and an explicit yes; the private minimum is never spoken there.
 */

/** What the interview has gathered so far; every field is optional until the owner confirms. */
export interface CardDraft {
  trades?: Trade[];
  /** An area key, e.g. "koramangala". */
  area?: string;
  rate_paise?: number;
  limit_paise?: number;
  languages?: Lang[];
  about?: string;
  ask_me?: QuestionKey[];
  auto?: boolean;
}

/** A pilot area by key, with every name it may be spoken or typed as, in each script and in English. */
export interface AreaChoice {
  key: string;
  names: readonly string[];
}

export interface InterviewConfig {
  /** The owner's language: asked first among the languages, and the one questions are read in. */
  own: Lang;
  areas: readonly AreaChoice[];
  /** The city's going rates, for the amount check. */
  rates: RateCard;
}

/** Where the interview is: the field being asked, then confirm, then done. */
export const Slot = {
  trade: "trade",
  area: "area",
  rate: "rate",
  min: "min",
  languages: "languages",
  about: "about",
  ask_first: "ask_first",
  auto: "auto",
  confirm: "confirm",
  done: "done",
} as const;
export type Slot = (typeof Slot)[keyof typeof Slot];

/** One line the app shows (and reads aloud unless `silent`). `prices` are paise, formatted by the app with `money()`. */
export interface Line {
  key: MessageKey;
  params?: Record<string, string | number>;
  prices?: Record<string, number>;
  silent?: true;
}

/** A tap answer: the value `choose()` takes, and the label shown. */
export interface Choice {
  value: string;
  key: MessageKey;
}

/** What to show now: lines, the tap choices, whether the answer is an amount, and words the recognizer should expect. */
export interface Prompt {
  lines: Line[];
  choices?: Choice[];
  numeric?: boolean;
  hints: string[];
}

/** The interview between turns. Treat as opaque outside this module. */
export interface InterviewState {
  readonly config: InterviewConfig;
  readonly draft: CardDraft;
  readonly slot: Slot;
}

/** A new interview, at the first field, or pre-filled from the card the owner already has. */
export function start(_config: InterviewConfig, _existing?: CardDraft): InterviewState {
  throw new NotBuiltError("interview.start");
}

/** Whatever is current: the readback of the last answer, a retry, an amount check, the question, or the summary. */
export function prompt(_state: InterviewState): Prompt {
  throw new NotBuiltError("interview.prompt");
}

/** An answer in words, spoken or typed. */
export function hear(_state: InterviewState, _text: string): InterviewState {
  throw new NotBuiltError("interview.hear");
}

/** An answer by tapping one of the prompt's choices. */
export function choose(_state: InterviewState, _value: string): InterviewState {
  throw new NotBuiltError("interview.choose");
}

/** Jumps to one field; after it is answered the interview returns to confirm. */
export function edit(_state: InterviewState, _slot: Slot): InterviewState {
  throw new NotBuiltError("interview.edit");
}

export function draftOf(_state: InterviewState): CardDraft {
  throw new NotBuiltError("interview.draftOf");
}

/** The field a sentence asks to change ("मेरा रेट बदलो" → rate). Needs a change word and a field word together. */
export function editIntent(_text: string): Slot | undefined {
  throw new NotBuiltError("interview.editIntent");
}

/** The first amount in the text, in paise: digits in any script, number words, multipliers and fractions. */
export function parseAmount(_text: string): number | undefined {
  throw new NotBuiltError("interview.parseAmount");
}

/** Yes-or-no details these trades' agents ask about, which the worker may want to see before any quote. */
export function askable(_trades: readonly Trade[]): QuestionKey[] {
  throw new NotBuiltError("interview.askable");
}
