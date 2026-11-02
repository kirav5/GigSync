import type { Arrangement, Lang, QuestionKey, RateCard, Trade } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { ASK_FIRST_DETAILS } from "../job/details.js";
import type { TermPrefs } from "../job/terms.js";
import { QUESTIONS } from "../job/worker.js";
import { arranged, missingRate } from "./card-arrangements.js";
import type { FoundEstimate } from "./estimate-lines.js";
import type { Field } from "./lexicon.js";

/**
 * The card interview's shape and how it moves: what it gathers, the order of the questions, and where an answer or
 * an edit leads. Reading the answers themselves is `card-parse.ts`.
 */

/** What the interview has gathered so far; every field is optional until the owner confirms. */
export interface CardDraft {
  trades?: Trade[];
  /** An area key: a pilot area's ("koramangala"), or a locality's slug when the worker used their location. */
  area?: string;
  /** ADR 0045: the worker's own area when it is not a pilot area: its name and coarse point. */
  place?: { name: string; lat: number; lon: number };
  /** ADR 0046: for a maid or driver, the arrangements they take; the usual rate is for the main one. */
  arrangements?: Arrangement[];
  /** ADR 0046: the usual rate for each other arrangement picked. */
  other_rates?: Partial<Record<Arrangement, number>>;
  /** ADR 0045: how far from their area they go, in km; the card form sets it, the interview keeps it. */
  radius_km?: number;
  rate_paise?: number;
  limit_paise?: number;
  languages?: Lang[];
  about?: string;
  ask_me?: QuestionKey[];
  auto?: boolean;
  /** When they take work, who buys materials, a day's hours: what their agent agrees besides the price. */
  terms?: TermPrefs;
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
  /** Which arrangements a maid or driver takes (ADR 0046). */
  arrangements: "arrangements",
  area: "area",
  rate: "rate",
  min: "min",
  /** The usual rate for each other arrangement picked. */
  more_rates: "more_rates",
  languages: "languages",
  about: "about",
  ask_first: "ask_first",
  auto: "auto",
  confirm: "confirm",
  done: "done",
} as const;
export type Slot = (typeof Slot)[keyof typeof Slot];

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
}

/** The interview between turns. Treat as opaque outside this module. */
export interface InterviewState {
  readonly config: InterviewConfig;
  readonly draft: CardDraft;
  readonly slot: Slot;
  /** Shown before the question: the readback of the last answer, a retry, or why an answer was refused. */
  readonly notes: readonly Line[];
  /** An amount outside the usual range, kept only after the owner says it again or says yes. */
  readonly pending?: number | undefined;
  /** `pending` was said aloud rather than typed, so reading it back aloud tells nobody nearby anything new. */
  readonly pendingAloud?: boolean | undefined;
  /** Unclear answers to the question now asked; the yes-or-no questions settle on no after two. */
  readonly misses: number;
  /** Which of `askable(trades)` the ask-first question is on. */
  readonly ask: number;
  /** Answering one field from confirm: back to confirm once the card is whole again. */
  readonly editing: boolean;
  /** At confirm after a no: asking which field to change. */
  readonly changing: boolean;
  /** Nothing answered yet: the first prompt says what is about to happen. */
  readonly fresh: boolean;
  /** The rate estimate the app found for the worker's first trade (`card-estimate.ts`), if any. */
  readonly estimate?: FoundEstimate | undefined;
}

/** The values tap choices carry besides trades, areas, languages and fields. */
export const Pick = { yes: "yes", no: "no", none: "none", skip: "skip", suggested: "suggested" } as const;

/** The fields an owner can change from confirm, in the order the chips show them. */
export const FIELDS: readonly Field[] = [
  Slot.trade,
  Slot.area,
  Slot.rate,
  Slot.min,
  Slot.languages,
  Slot.about,
  Slot.auto,
];
const ORDER: readonly Slot[] = [
  Slot.trade,
  Slot.arrangements,
  Slot.area,
  Slot.rate,
  Slot.min,
  Slot.more_rates,
  Slot.languages,
  Slot.about,
  Slot.ask_first,
  Slot.auto,
  Slot.confirm,
];

/** Yes-or-no details these trades' agents ask about, which the worker may want to see before any quote. */
export const askable = (trades: readonly Trade[]): QuestionKey[] =>
  [...ASK_FIRST_DETAILS].filter((k) => trades.some((tr) => QUESTIONS[tr].includes(k)));

const complete = (d: CardDraft): boolean =>
  !!d.trades?.length &&
  d.area !== undefined &&
  d.rate_paise !== undefined &&
  d.limit_paise !== undefined &&
  d.limit_paise <= d.rate_paise &&
  missingRate(d) === undefined;

function firstMissing(d: CardDraft): Slot {
  if (!d.trades?.length) return Slot.trade;
  if (arranged(d) && d.arrangements === undefined) return Slot.arrangements;
  if (d.area === undefined) return Slot.area;
  if (d.rate_paise === undefined) return Slot.rate;
  if (d.limit_paise === undefined || d.limit_paise > d.rate_paise) return Slot.min;
  return complete(d) ? Slot.confirm : Slot.more_rates;
}

/** A new interview, at the first field, or pre-filled from the card the owner already has. */
export function start(config: InterviewConfig, existing: CardDraft = {}): InterviewState {
  const draft = { ...existing };
  const ready = complete(draft);
  return {
    config,
    draft,
    slot: ready ? Slot.confirm : firstMissing(draft),
    notes: [],
    misses: 0,
    ask: 0,
    editing: false,
    // A whole card goes straight to what to change: that is why the owner is here.
    changing: ready,
    fresh: true,
  };
}

/** The same question again, after a note saying why. */
export const retry = (s: InterviewState, note: Line): InterviewState => ({ ...s, notes: [note], fresh: false });

function nextSlot(s: InterviewState, draft: CardDraft): Slot {
  const asks = askable(draft.trades ?? []).length > 0;
  // A new trade may bring its own arrangements and ask-first question; new arrangements a rate in another unit; a new
  // rate may sit below the old minimum. Each other arrangement's rate is asked until none is missing.
  if (s.editing && s.slot === Slot.trade && arranged(draft)) return Slot.arrangements;
  if (s.editing && s.slot === Slot.trade && asks) return Slot.ask_first;
  if (s.editing && s.slot === Slot.arrangements) return Slot.rate;
  if (s.editing && s.slot === Slot.rate && !complete(draft)) return Slot.min;
  if (s.slot === Slot.more_rates && missingRate(draft)) return Slot.more_rates;
  if (s.editing) return complete(draft) ? Slot.confirm : firstMissing(draft);
  const skipped = (slot: Slot | undefined) =>
    (slot === Slot.ask_first && !asks) ||
    (slot === Slot.arrangements && !arranged(draft)) ||
    (slot === Slot.more_rates && !missingRate(draft));
  let i = ORDER.indexOf(s.slot) + 1;
  while (skipped(ORDER[i])) i++;
  return ORDER[i] ?? Slot.confirm;
}

/** The current field answered: on to the next one, with an optional readback. */
export function advance(s: InterviewState, draft: CardDraft, notes: Line[] = []): InterviewState {
  const slot = nextSlot(s, draft);
  const back = slot === Slot.confirm;
  return {
    ...s,
    draft,
    slot,
    notes,
    pending: undefined,
    pendingAloud: undefined,
    misses: 0,
    ask: 0,
    fresh: false,
    editing: !back && s.editing,
  };
}

/** Jumps to one field; after it is answered the interview returns to confirm. */
export function edit(state: InterviewState, slot: Slot): InterviewState {
  const base = {
    ...state,
    notes: [],
    pending: undefined,
    pendingAloud: undefined,
    misses: 0,
    ask: 0,
    fresh: false,
    changing: false,
  };
  if (slot === Slot.confirm || slot === Slot.done) return { ...base, slot: Slot.confirm, editing: false };
  return { ...base, slot, editing: true };
}

export const draftOf = (state: InterviewState): CardDraft => ({ ...state.draft });

/**
 * The same interview under new settings, for an owner who changed the app's language part-way: the questions from
 * here on, the words the recognizer expects and the language counted as their own follow the new one. The answers
 * stay; the readback already shown is not repeated when the question now open is asked again.
 */
export const withConfig = (state: InterviewState, config: InterviewConfig): InterviewState => ({
  ...state,
  config,
  notes: [],
});
