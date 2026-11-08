import type { Arrangement, Lang, QuestionKey, RateCard, Skill, Trade } from "@gigsync/protocol";
import { ASK_FIRST_DETAILS } from "../job/details.js";
import { QUESTIONS } from "../job/worker.js";
import type { TermPrefs } from "../job/worker-stance.js";
import type { WorkMatch } from "../skills/suggest.js";
import { alsoKinds } from "./card-also.js";
import { arranged, missingRate } from "./card-arrangements.js";
import type { Line } from "./card-lines.js";
import type { FoundEstimate } from "./estimate-lines.js";
import type { Field } from "./lexicon.js";

export type { Choice, Line, Prompt } from "./card-lines.js";

/**
 * The card interview's shape and how it moves: what it gathers, the order of the questions, and where an answer or
 * an edit leads. Reading the answers themselves is `card-parse.ts`.
 */

/** What the interview has gathered so far; every field is optional until the owner confirms. */
export interface CardDraft {
  trades?: Trade[];
  /** ADR 0047: work outside the trades, in the worker's own words. A card needs a trade or a skill. */
  skills?: Skill[];
  /** An area key: a pilot area's ("koramangala"), or a locality's slug when the worker used their location. */
  area?: string;
  /** ADR 0045: the worker's own area when it is not a pilot area: its name and coarse point. */
  place?: { name: string; lat: number; lon: number };
  /** ADR 0046: for a maid or driver, the arrangements they take; the usual rate is for the main one. */
  arrangements?: Arrangement[];
  /** ADR 0046: the usual rate for each other arrangement picked. */
  other_rates?: Partial<Record<Arrangement, number>>;
  /** ADR 0045: how far from their area they go, in km. */
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
  /** The area's name in each language, for an area the app has no catalog name for (ADR 0061: kept in the directory). */
  label?: Readonly<Record<Lang, string>>;
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
  /** The other kinds of work in the same group, to tick (ADR 0061). */
  also: "also",
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
  /** The card is off the board, so a whole card opens on putting it back, and there is nothing to take off. */
  readonly offBoard?: boolean | undefined;
  /** The other arrangement whose rate is being changed; none asks for the next one missing. */
  readonly rateFor?: Arrangement | undefined;
  /** The start hour said, while the question is until when. */
  readonly from?: number | undefined;
  /** The words that asked for a change and named its value, kept while the question is which rate it is for. */
  readonly heard?: string | undefined;
  /** At the work question: the trade or kind of work the worker's own words may be, asked as yes or no (ADR 0059). */
  readonly kind?: WorkMatch | undefined;
  /** The skill that question is about. */
  readonly asking?: Skill | undefined;
}

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
  Slot.hours,
  Slot.days,
  Slot.languages,
  Slot.about,
  Slot.ask_first,
  Slot.materials,
  Slot.max_hours,
  Slot.auto,
  Slot.unlist,
];
const ORDER: readonly Slot[] = [
  Slot.trade,
  Slot.also,
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

/** The card names some work: a trade, or a skill of the worker's own. */
/** The interview has been answered for good: the card is being sent, or taken off the board. */
export const isLastSlot = (slot: Slot): boolean => slot === Slot.done || slot === Slot.unlisted;

export const hasWork = (d: CardDraft): boolean => !!d.trades?.length || !!d.skills?.length;

const complete = (d: CardDraft): boolean =>
  hasWork(d) &&
  d.area !== undefined &&
  d.rate_paise !== undefined &&
  d.limit_paise !== undefined &&
  d.limit_paise <= d.rate_paise &&
  missingRate(d) === undefined;

function firstMissing(d: CardDraft): Slot {
  if (!hasWork(d)) return Slot.trade;
  if (arranged(d) && d.arrangements === undefined) return Slot.arrangements;
  if (d.area === undefined) return Slot.area;
  if (d.rate_paise === undefined) return Slot.rate;
  if (d.limit_paise === undefined || d.limit_paise > d.rate_paise) return Slot.min;
  return complete(d) ? Slot.confirm : Slot.more_rates;
}

/** A new interview, at the first field, or pre-filled from the card the owner already has. */
export function start(config: InterviewConfig, existing: CardDraft = {}, offBoard = false): InterviewState {
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
    // A whole card goes straight to what to change: that is why the owner is here. Off the board, it is to put it back.
    changing: ready && !offBoard,
    fresh: true,
    offBoard,
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
    (slot === Slot.also && alsoKinds(draft).length === 0) ||
    (slot === Slot.ask_first && !asks) ||
    (slot === Slot.arrangements && !arranged(draft)) ||
    (slot === Slot.more_rates && !missingRate(draft));
  let i = ORDER.indexOf(s.slot) + 1;
  while (skipped(ORDER[i])) i++;
  return ORDER[i] ?? Slot.confirm;
}

/** What no question carries over to the next. */
const BETWEEN_QUESTIONS = {
  pending: undefined,
  pendingAloud: undefined,
  misses: 0,
  ask: 0,
  fresh: false,
  rateFor: undefined,
  from: undefined,
  heard: undefined,
  kind: undefined,
  asking: undefined,
} as const;

/** The current field answered: on to the next one, with an optional readback. */
export function advance(s: InterviewState, draft: CardDraft, notes: Line[] = []): InterviewState {
  const slot = nextSlot(s, draft);
  const back = slot === Slot.confirm;
  return {
    ...s,
    draft,
    slot,
    notes,
    ...BETWEEN_QUESTIONS,
    editing: !back && s.editing,
  };
}

/** Opens one slot; after it is answered the interview returns to confirm. `edit` is the way in for an owner's choice. */
export function openSlot(state: InterviewState, slot: Slot): InterviewState {
  const base = { ...state, ...BETWEEN_QUESTIONS, notes: [], changing: false };
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
