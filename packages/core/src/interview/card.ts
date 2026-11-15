import type { Arrangement, Lang, QuestionKey, RateCard, Skill, Trade } from "@gigsync/protocol";
import { ASK_FIRST_DETAILS } from "../job/details.js";
import type { WorkId } from "../job/work-rates.js";
import { QUESTIONS } from "../job/worker.js";
import type { TermPrefs } from "../job/worker-stance.js";
import type { WorkMatch } from "../skills/suggest.js";
import { alsoKinds } from "./card-also.js";
import { arranged, missingRate } from "./card-arrangements.js";
import type { InterviewConfig } from "./card-config.js";
import type { Filing } from "./card-guess.js";
import type { Line } from "./card-lines.js";
import { Slot } from "./card-slots.js";
import { asksWorkRates, missingWorkRate } from "./card-work-list.js";
import type { FoundEstimate } from "./estimate-lines.js";

export type { AreaChoice, InterviewConfig } from "./card-config.js";
export type { Choice, Line, Prompt } from "./card-lines.js";
export { FIELDS, Pick, Slot } from "./card-slots.js";

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
  /** ADR 0062: false when the worker charges differently for each kind; the card's rate is for its first kind. */
  same_rate?: boolean;
  /** ADR 0062: the usual rate for each kind besides the first, by kind. */
  work_rates?: Partial<Record<WorkId, number>>;
  /** ADR 0062: a kind's lowest, when set apart from the share of the card's own (My card). */
  work_limits?: Partial<Record<WorkId, number>>;
  languages?: Lang[];
  about?: string;
  ask_me?: QuestionKey[];
  /** ADR 0063: what they need to know before quoting, in their own words; private. */
  asks?: string[];
  auto?: boolean;
  /** When they take work, who buys materials, a day's hours: what their agent agrees besides the price. */
  terms?: TermPrefs;
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
  /** Work in the worker's own words from the work step, asked about against the kinds closest to it (`card-guess.ts`). */
  readonly filing?: Filing | undefined;
}

const ORDER: readonly Slot[] = [
  Slot.trade,
  Slot.also,
  Slot.arrangements,
  Slot.area,
  Slot.radius,
  Slot.rate,
  Slot.min,
  Slot.more_rates,
  Slot.same_rate,
  Slot.work_rate,
  Slot.languages,
  Slot.about,
  Slot.ask_first,
  Slot.asks,
  Slot.auto,
  Slot.confirm,
];

/** Yes-or-no details these trades' agents ask about, which the worker may want to see before any quote. */
export const askable = (trades: readonly Trade[]): QuestionKey[] =>
  [...ASK_FIRST_DETAILS].filter((k) => trades.some((tr) => QUESTIONS[tr].includes(k)));

/** The interview has been answered for good: the card is being sent, or taken off the board. */
export const isLastSlot = (slot: Slot): boolean => slot === Slot.done || slot === Slot.unlisted;

/** The card names some work: a trade, or a skill of the worker's own. */
export const hasWork = (d: CardDraft): boolean => !!d.trades?.length || !!d.skills?.length;

const complete = (d: CardDraft): boolean =>
  hasWork(d) &&
  d.area !== undefined &&
  d.rate_paise !== undefined &&
  d.limit_paise !== undefined &&
  d.limit_paise <= d.rate_paise &&
  missingRate(d) === undefined &&
  missingWorkRate(d) === undefined;

function firstMissing(d: CardDraft): Slot {
  if (!hasWork(d)) return Slot.trade;
  if (d.area === undefined) return Slot.area;
  if (d.rate_paise === undefined) return Slot.rate;
  if (d.limit_paise === undefined || d.limit_paise > d.rate_paise) return Slot.min;
  if (complete(d)) return Slot.confirm;
  return missingRate(d) ? Slot.more_rates : Slot.work_rate;
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
  if ((s.slot === Slot.same_rate || s.slot === Slot.work_rate) && missingWorkRate(draft)) return Slot.work_rate;
  if (s.editing) return complete(draft) ? Slot.confirm : firstMissing(draft);
  const skipped = (slot: Slot | undefined) =>
    (slot === Slot.also && alsoKinds(draft).length === 0) ||
    (slot === Slot.ask_first && !asks) ||
    // The price card asks how the work is priced (`card-price.ts`); the chips for several are for an edit.
    slot === Slot.arrangements ||
    // How far they go is asked once, right after the area; a card that has it keeps it.
    (slot === Slot.radius && draft.radius_km !== undefined) ||
    (slot === Slot.more_rates && !missingRate(draft)) ||
    (slot === Slot.same_rate && !asksWorkRates(draft)) ||
    (slot === Slot.work_rate && !missingWorkRate(draft));
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
  filing: undefined,
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
