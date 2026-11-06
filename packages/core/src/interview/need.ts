import { AnswerFromMemory, JobTrade, type ListedRates, type QuestionKey, type Trade } from "@gigsync/protocol";
import { EVERY_DAY, isMonthly } from "../job/when.js";
import { QUESTIONS } from "../job/worker.js";
import type { Line } from "./card.js";
import { priceOpen } from "./driver-ask.js";
import type { FoundEstimate } from "./estimate-lines.js";
import { arrangedWork, needsArrangement } from "./need-arrangement.js";
import type { Recalled } from "./need-memory.js";
import type { WorkSwitch } from "./need-switch.js";
import { needsHour } from "./need-terms.js";
import type { NeedConfig, NeedDraft, NeedTo } from "./need-types.js";

/**
 * The need interview's shape and how it moves: a household (or a worker hiring a helper) says what they need, in one
 * sentence or several turns, and the interview asks only for what is still missing, then reads it back before any
 * search. Reading the answers is `need-hear.ts`; the questions are `need-prompt.ts`.
 */

/** A day said as a word; resolved to the phone's calendar day only when the request is sent. */
export const DayWord = { today: "today", tomorrow: "tomorrow" } as const;
export type DayWord = (typeof DayWord)[keyof typeof DayWord];

export type { ModelAsk, NeedConfig, NeedDraft, NeedMemory, NeedTo } from "./need-types.js";

/** Where the interview is: a field being asked, the readback, the search, or what it found. */
export const NeedSlot = {
  trade: "trade",
  /** The scope read from the owner's words, as chips to confirm. */
  scope: "scope",
  detail: "detail",
  /** How long the work is for, for maid and driver work (ADR 0046). */
  arrangement: "arrangement",
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
export type NeedField = Extract<NeedSlot, "trade" | "detail" | "arrangement" | "area" | "when" | "budget">;
export const NEED_FIELDS: readonly NeedField[] = [
  NeedSlot.trade,
  NeedSlot.detail,
  NeedSlot.arrangement,
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
  /** What workers nearby list for a skill, for the budget question (ADR 0057); never a model's figure. */
  readonly listed?: ListedRates | undefined;
  /** The worker the need is addressed to; undefined when the board is searched. */
  readonly to?: NeedTo | undefined;
  /** Other work the owner named part-way: asked about before anything else (`need-switch.ts`). */
  readonly switching?: WorkSwitch | undefined;
}

/** The trade's first question, which the request answers up front so the worker's agent need not ask it. */
export const firstQuestion = (trade: JobTrade | undefined): QuestionKey | undefined =>
  trade ? QUESTIONS[trade][0] : undefined;

/** The kind of work a draft is for: its trade, `other` for a listed skill (ADR 0047), or not known yet. */
export const workOf = (d: Pick<NeedDraft, "trade" | "skill">): JobTrade | undefined =>
  d.trade ?? (d.skill ? JobTrade.enum.other : undefined);

/**
 * The next field still missing, in the order asked; confirm once the need is whole. A household's need is not whole
 * without one of its saved addresses (ADR 0045): an area alone narrows the search, but the worker must be sent to a
 * real door, never to whatever address an older screen once took.
 */
export function firstMissing(d: NeedDraft, needsAddress = false): NeedSlot {
  if (!d.trade && !d.skill && d.jobType) return priceOpen(d) ? NeedSlot.driver : NeedSlot.outside;
  if (!d.trade && !d.skill) return NeedSlot.trade;
  if (d.scope && !d.scope.confirmed) return NeedSlot.scope;
  if (firstQuestion(workOf(d)) && d.detail === undefined) return NeedSlot.detail;
  if (needsArrangement(d)) return NeedSlot.arrangement;
  if (d.area === undefined || (needsAddress && d.address === undefined)) return NeedSlot.area;
  if (priceOpen(d)) return NeedSlot.driver;
  // The day, then the hour in it (need-time.ts); a time said with the day answers both.
  if (d.day === undefined || needsHour(d)) return NeedSlot.when;
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
  return { ...d, trade, skill: undefined, detail: first ? d.seen[first] : undefined, ...(day ? { day } : {}) };
}

/** A new need; addressed `to` one worker, it is for their trade from the start when their card has only one. */
export function startNeed(config: NeedConfig, to?: NeedTo): NeedState {
  const work = [...(to?.trades ?? []), ...(to?.skills ?? [])];
  const [only] = work;
  const empty: NeedDraft = config.modelQuestions ? { seen: {}, modelAsk: { said: [], covered: [] } } : { seen: {} };
  const one = work.length === 1 ? only : undefined;
  const draft: NeedDraft =
    one === undefined ? empty : typeof one === "string" ? withTrade(empty, one) : { ...empty, skill: one };
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
  const question = field === NeedSlot.detail ? firstQuestion(workOf(s.draft)) : undefined;
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

/**
 * The address a need takes without asking: the one in use while no place was named, as the top of the screen says,
 * else the household's one saved address in the area named; else the draft as it is.
 */
function withKnownAddress(config: NeedConfig, d: NeedDraft): NeedDraft {
  if (!config.addresses || d.address !== undefined) return d;
  const inArea = config.addresses.filter((a) => a.area === d.area);
  const found =
    d.area === undefined
      ? config.addresses.find((a) => a.id === config.inUse)
      : inArea.length === 1
        ? inArea[0]
        : undefined;
  return found ? { ...d, area: found.area, areaName: found.areaName, address: found.id } : d;
}

/** Where a need goes next: the household's address settled if it can be, then whatever is still missing. */
function nextSlot(config: NeedConfig, d: NeedDraft): { draft: NeedDraft; slot: NeedSlot } {
  const draft = withKnownAddress(config, d);
  return { draft, slot: firstMissing(draft, config.addresses !== undefined) };
}

/** "Answer for me": each fresh remembered answer fills its question as it comes up (the prompt says so). */
function autoFilled(s: NeedState): NeedState {
  if (s.config.remembered?.mode !== AnswerFromMemory.enum.auto) return s;
  let next = s;
  for (let r = recalled(next); r?.known.fresh; r = recalled(next)) {
    const { draft, slot } = nextSlot(next.config, withRecalled(next.draft, next.slot, r.known.value));
    next = { ...next, draft, slot, filled: [...next.filled, next.slot] };
  }
  return next;
}

/** An answer taken: on to whatever is still missing (filling what memory may), or the readback. */
export const moveOn = (s: NeedState, draft: NeedDraft, notes: Line[] = []): NeedState =>
  autoFilled({ ...s, ...nextSlot(s.config, draft), notes, changing: false, fresh: false, filled: [] });

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
  const usable =
    (field !== NeedSlot.detail || firstQuestion(workOf(s.draft)) !== undefined) &&
    (field !== NeedSlot.arrangement || arrangedWork(s.draft));
  const ownAnswer = [...s.ownAnswer, field];
  const slot = usable ? field : NeedSlot.confirm;
  return { ...s, slot, notes: [], changing: !usable, fresh: false, ownAnswer, filled: [] };
}

/** Past a need outside the trades: the interview starts over, knowing the first words were not the end of it. */
export const afterOutside = (s: NeedState): NeedState => ({
  ...s,
  draft: s.config.modelQuestions ? { seen: {}, modelAsk: { said: [], covered: [] } } : { seen: {} },
  slot: NeedSlot.trade,
  notes: [],
});

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
