import {
  AnswerFromMemory,
  type DriverName,
  type DriverValues,
  type EstimateFact,
  type Lang,
  type QuestionKey,
  type RateCard,
  type Trade,
  type UserId,
} from "@gigsync/protocol";
import { EVERY_DAY, isMonthly } from "../job/when.js";
import { QUESTIONS } from "../job/worker.js";
import type { Known } from "../memory/known.js";
import type { AreaChoice, Line } from "./card.js";
import { priceOpen } from "./driver-ask.js";
import type { FoundEstimate } from "./estimate-lines.js";
import type { Recalled } from "./need-memory.js";
import type { PriceQA, PriceQuestion } from "./price-model.js";
import type { ScopeChip } from "./scope-read.js";

/**
 * The need interview's shape and how it moves: a household (or a worker hiring a helper) says what they need, in one
 * sentence or several turns, and the interview asks only for what is still missing, then reads it back before any
 * search. Reading the answers is `need-hear.ts`; the questions are `need-prompt.ts`.
 */

/** A day said as a word; resolved to the phone's calendar day only when the request is sent. */
export const DayWord = { today: "today", tomorrow: "tomorrow" } as const;
export type DayWord = (typeof DayWord)[keyof typeof DayWord];

/** What the interview has gathered so far. */
export interface NeedDraft {
  trade?: Trade | undefined;
  /** The owner's own words about the need, as they said them: what the worker reads. */
  need?: string | undefined;
  /** The answer to the trade's first question (`QUESTIONS[trade][0]`); null when the owner skipped it. */
  detail?: string | null | undefined;
  /** Details the owner's words already gave, by question, kept until the trade that asks them is known. */
  seen: Partial<Record<QuestionKey, string>>;
  /** An area key, e.g. "hsr_layout". */
  area?: string | undefined;
  /** A `DayWord`, `EVERY_DAY`, or a day as "YYYY-MM-DD". */
  day?: string | undefined;
  /** The time as the owner said it ("10 am", "सुबह"), for people only. */
  time?: string | undefined;
  /** The most they will pay. Never leaves the phone; the agent negotiates up to it. */
  budget_paise?: number | undefined;
  /** Scope read from the owner's description: chips to confirm before the estimate is asked (`need-scope.ts`). */
  scope?: { chips: readonly ScopeChip[]; confirmed: boolean } | undefined;
  /** Price drivers (ADR 0041) read from the owner's words or answered; the details give the rest (`draftDrivers`). */
  drivers?: DriverValues | undefined;
  /** Drivers the owner said they do not know: assumed by the estimate, never asked again. */
  notKnown?: readonly DriverName[] | undefined;
  /** Price questions asked so far, at most `MAX_PRICE_QUESTIONS`. */
  askedDrivers?: number | undefined;
  /** The price questions are over: the owner did not know or skipped one, the model was done, or none is worth it. */
  priceDone?: boolean | undefined;
  /** With a usable phone model: its questions (`price-model.ts`); absent in lite mode or once the model failed. */
  modelAsk?: ModelAsk | undefined;
  /** Facts the phone's model wrote from the answers, scrubbed; kept on the phone for the owner's agent, never sent. */
  facts?: readonly EstimateFact[] | undefined;
  /** A need outside GigSync's trades, as a short label the phone's model gave ("wedding photographer"). */
  jobType?: string | undefined;
}

/** The model's side of the price questions: the question waiting, what was asked and said, what it covered. */
export interface ModelAsk {
  current?: PriceQuestion | undefined;
  said: readonly PriceQA[];
  /** Drivers the model's questions filled: the safeguard adds the top driver only when it is not among them. */
  covered: readonly DriverName[];
  /** The job's most price-moving unknown driver when the model began: the one question code guarantees. */
  top?: DriverName | undefined;
}

export interface NeedConfig {
  /** The owner's language: the one questions are read in, and the hints the recognizer gets. */
  own: Lang;
  areas: readonly AreaChoice[];
  /** The city's going rates, shown as a hint beside the budget question. */
  rates: RateCard;
  /** The phone's calendar day when the interview started, "YYYY-MM-DD", for dates said without a year. */
  today: string;
  /** The phone has a usable model (ADR 0040): it decides the price questions; lite mode asks the fixed ones. */
  modelQuestions?: boolean;
  /** What the owner's agent remembers from past jobs, and whether to ask before using it; never the budget. */
  remembered?: NeedMemory;
}

/** The household's remembered area (a key of `areas`) and stable facts by question, and the owner's setting. */
export interface NeedMemory {
  mode: AnswerFromMemory;
  area?: Known;
  facts: Partial<Record<QuestionKey, Known>>;
}

/**
 * The one worker a need is addressed to, when the household chose them before asking (their QR, their offer to work):
 * the interview asks only what that worker needs to hear, never searches, and sends to them alone (ADR 0035).
 */
export interface NeedTo {
  user: UserId;
  /** Their name on their card, as the questions say it. */
  name: string;
  /** The trades on their card: the need is for one of them, asked only when there are several. */
  trades: readonly Trade[];
}

/** Where the interview is: a field being asked, the readback, the search, or what it found. */
export const NeedSlot = {
  trade: "trade",
  /** The scope read from the owner's words, as chips to confirm. */
  scope: "scope",
  detail: "detail",
  /** A price driver that moves the range most (ADR 0041), asked before the estimate. */
  driver: "driver",
  area: "area",
  when: "when",
  budget: "budget",
  confirm: "confirm",
  /** The owner said yes: the app searches the board now. */
  done: "done",
  /** The search found workers: the app shows them to pick and ask. */
  found: "found",
  /** The search found nobody: look further, or change something. */
  nobody: "nobody",
  /** A need outside the trades: GigSync has no prices for it yet and nobody offers it on GigSync. */
  outside: "outside",
} as const;
export type NeedSlot = (typeof NeedSlot)[keyof typeof NeedSlot];

/** A field the owner can change from the readback. */
export type NeedField = Extract<NeedSlot, "trade" | "detail" | "area" | "when" | "budget">;
export const NEED_FIELDS: readonly NeedField[] = [
  NeedSlot.trade,
  NeedSlot.detail,
  NeedSlot.area,
  NeedSlot.when,
  NeedSlot.budget,
];

/** How far the board is searched, nearest first; the first is where every search starts. */
export const SEARCH_RADII_KM = [5, 10, 25] as const;

/** The interview between turns. Treat as opaque outside these modules. */
export interface NeedState {
  readonly config: NeedConfig;
  readonly draft: NeedDraft;
  readonly slot: NeedSlot;
  /** Shown before the question: a retry, a readback, or why a search failed. */
  readonly notes: readonly Line[];
  /** At confirm after a no: asking which field to change. */
  readonly changing: boolean;
  /** Nothing answered yet: the first question invites the whole need in the owner's own words. */
  readonly fresh: boolean;
  readonly radius_km: number;
  /** Fields the owner chose to answer themselves (Change, or picked from the readback): memory stays out of them. */
  readonly ownAnswer: readonly NeedSlot[];
  /** Fields the agent just filled from memory ("Answer for me"), offered to change under the next question. */
  readonly filled: readonly NeedSlot[];
  /** The rate estimate the app found for the job as described (`need-estimate.ts`), if any. */
  readonly estimate?: FoundEstimate | undefined;
  /** The worker the need is addressed to; undefined when the board is searched. */
  readonly to?: NeedTo | undefined;
}

/** The trade's first question, which the request answers up front so the worker's agent need not ask it. */
export const firstQuestion = (trade: Trade | undefined): QuestionKey | undefined =>
  trade ? QUESTIONS[trade][0] : undefined;

/** The next field still missing, in the order asked; confirm once the need is whole. */
export function firstMissing(d: NeedDraft): NeedSlot {
  if (!d.trade && d.jobType) return priceOpen(d) ? NeedSlot.driver : NeedSlot.outside;
  if (!d.trade) return NeedSlot.trade;
  if (d.scope && !d.scope.confirmed) return NeedSlot.scope;
  if (firstQuestion(d.trade) && d.detail === undefined) return NeedSlot.detail;
  if (d.area === undefined) return NeedSlot.area;
  if (priceOpen(d)) return NeedSlot.driver;
  if (d.day === undefined) return NeedSlot.when;
  if (d.budget_paise === undefined) return NeedSlot.budget;
  return NeedSlot.confirm;
}

/**
 * The draft with a trade set: the detail follows the trade's own first question (from what the owner already said,
 * or asked next), and monthly work is every day unless the owner said otherwise.
 */
export function withTrade(d: NeedDraft, trade: Trade): NeedDraft {
  if (d.trade === trade) return d;
  const first = firstQuestion(trade);
  const day = d.day ?? (isMonthly(trade) ? EVERY_DAY : undefined);
  return { ...d, trade, detail: first ? d.seen[first] : undefined, ...(day ? { day } : {}) };
}

/** A new need; addressed `to` one worker, it is for their trade from the start when their card has only one. */
export function startNeed(config: NeedConfig, to?: NeedTo): NeedState {
  const [only, ...others] = to?.trades ?? [];
  const empty: NeedDraft = config.modelQuestions ? { seen: {}, modelAsk: { said: [], covered: [] } } : { seen: {} };
  const draft: NeedDraft = only && others.length === 0 ? withTrade(empty, only) : empty;
  return {
    config,
    draft,
    ...(to ? { to } : {}),
    slot: NeedSlot.trade,
    notes: [],
    changing: false,
    fresh: true,
    radius_km: SEARCH_RADII_KM[0],
    ownAnswer: [],
    filled: [],
  };
}

/** A trade the need can be for: any, or one on the card of the worker it is addressed to. */
export const tradeFor = (s: NeedState, trade: Trade | undefined): trade is Trade =>
  trade !== undefined && (!s.to || s.to.trades.includes(trade));

/** The same question again, after a note saying why. */
export const retryNeed = (s: NeedState, note: Line): NeedState => ({ ...s, notes: [note], fresh: false });

/** The remembered answer for a field (the one asked now by default), unless the owner chose to answer it. */
export function recalled(s: NeedState, field: NeedSlot = s.slot): Recalled | undefined {
  const memory = s.config.remembered;
  if (!memory || s.ownAnswer.includes(field)) return undefined;
  const question = field === NeedSlot.detail ? firstQuestion(s.draft.trade) : undefined;
  const fact = question ? memory.facts[question] : undefined;
  if (question && fact) return { known: fact, question };
  const area = field === NeedSlot.area ? memory.area : undefined;
  return area && s.config.areas.some((a) => a.key === area.value) ? { known: area, area: area.value } : undefined;
}

/** "Ask me first": the remembered answer for the question now asked, offered to use or change. */
export const offered = (s: NeedState): Recalled | undefined =>
  s.config.remembered?.mode === AnswerFromMemory.enum.ask ? recalled(s) : undefined;

const withRecalled = (d: NeedDraft, field: NeedSlot, value: string): NeedDraft =>
  field === NeedSlot.area ? { ...d, area: value } : { ...d, detail: value };

/** "Answer for me": each fresh remembered answer fills its question as it comes up (the prompt says so). */
function autoFilled(s: NeedState): NeedState {
  if (s.config.remembered?.mode !== AnswerFromMemory.enum.auto) return s;
  let next = s;
  for (let r = recalled(next); r?.known.fresh; r = recalled(next)) {
    const draft = withRecalled(next.draft, next.slot, r.known.value);
    next = { ...next, draft, slot: firstMissing(draft), filled: [...next.filled, next.slot] };
  }
  return next;
}

/** An answer taken: on to whatever is still missing (filling what memory may), or the readback. */
export const moveOn = (s: NeedState, draft: NeedDraft, notes: Line[] = []): NeedState =>
  autoFilled({ ...s, draft, slot: firstMissing(draft), notes, changing: false, fresh: false, filled: [] });

/** "Use it": the remembered answer offered for the question now asked; anything else changes nothing. */
export function takeRecalled(s: NeedState): NeedState {
  const r = offered(s);
  return r ? moveOn(s, withRecalled(s.draft, s.slot, r.known.value)) : s;
}

/** "Change" on an offer: the owner answers the question themselves, asked as usual. */
export const answerMyself = (s: NeedState): NeedState =>
  offered(s) ? { ...s, ownAnswer: [...s.ownAnswer, s.slot], notes: [], fresh: false } : s;

/** Jumps to one field from the readback (or a Change chip); once it is answered the readback comes again. */
export function editNeed(s: NeedState, field: NeedField): NeedState {
  const usable = field !== NeedSlot.detail || firstQuestion(s.draft.trade) !== undefined;
  const ownAnswer = [...s.ownAnswer, field];
  const slot = usable ? field : NeedSlot.confirm;
  return { ...s, slot, notes: [], changing: !usable, fresh: false, ownAnswer, filled: [] };
}

/** What the board search found: workers to pick from, or nobody, with ways to look further. */
export const searchedNeed = (s: NeedState, count: number): NeedState => ({
  ...s,
  slot: count > 0 ? NeedSlot.found : NeedSlot.nobody,
  notes: [],
});

/** The search did not finish (no internet): say why and stand at the readback, so a yes tries again. */
export const searchFailed = (s: NeedState, note: Line): NeedState => ({
  ...s,
  slot: NeedSlot.confirm,
  notes: [note],
  changing: false,
});

/** The same interview under the owner's new language: questions from here on, and the hints, follow it. */
export const needWithConfig = (s: NeedState, config: NeedConfig): NeedState => ({ ...s, config });
