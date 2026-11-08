import { DetailFlag, Trade } from "@gigsync/protocol";
import { countIn } from "../job/details.js";
import { EVERY_DAY } from "../job/when.js";
import { type Line, Pick } from "./card.js";
import { minAloud } from "./card-parse.js";
import { withWordDrivers } from "./driver-ask.js";
import { areaIn, yesNo } from "./lexicon.js";
import {
  afterOutside,
  answerMyself,
  DayWord,
  editNeed,
  moveOn,
  NEED_FIELDS,
  type NeedDraft,
  type NeedField,
  NeedSlot,
  type NeedState,
  offered,
  retryNeed,
  SEARCH_RADII_KM,
  takeRecalled,
  tradeFor,
  withTrade,
} from "./need.js";
import { atArea, chooseAddress } from "./need-address.js";
import { chooseArrangement, hearArrangement } from "./need-arrangement.js";
import { detailAnswer, settledProblem } from "./need-detail.js";
import { chooseDriver, hearDriver } from "./need-drivers.js";
import { suggestedBudget } from "./need-estimate.js";
import { fillEmpty, fillFromHint } from "./need-fill.js";
import { chooseKindPick } from "./need-kinds.js";
import { MemoryPick } from "./need-memory.js";
import type { NeedHint } from "./need-model.js";
import { amountIn, DETAIL_MAX, type NeedFill, parseNeed } from "./need-parse.js";
import { Say } from "./need-say.js";
import { chooseScope, hearScope } from "./need-scope.js";
import { chooseSwitch, hearSwitch } from "./need-switch.js";
import { chooseHour, needsHour } from "./need-time.js";
import { NEED_FIELD_WORDS } from "./need-words.js";
import { finder, firstIn, normalize } from "./normalize.js";

/**
 * Turning an answer, said, typed or tapped, into the need interview's next state. Every answer is read whole: one
 * that also names the day or the budget fills those too, so the interview never asks what it was already told.
 */

/** What the tap choices carry besides trades, areas, days, radii and fields; `list` opens the trades (ADR 0051). */
export const NeedPick = {
  date: "date",
  change: "change",
  list: "list",
  notThis: "not_this",
  groups: "groups",
} as const;
/** The Change chips under a question, by the field the agent filled in from memory. */
const REDO = new Map<string, NeedField>([
  [MemoryPick.redoDetail, NeedSlot.detail],
  [MemoryPick.redoArea, NeedSlot.area],
]);
/** The When chips' values, in the order shown. */
const WHEN_VALUES: readonly string[] = [DayWord.today, DayWord.tomorrow, EVERY_DAY];
/** What `JobRequest.need` holds. */
const NEED_MAX = 1000;
const FIELD_FINDERS = NEED_FIELDS.map((f) => [f, NEED_FIELD_WORDS[f].map(finder)] as const);

/** The field an answer names ("बजट" is the budget). */
export function needFieldIn(text: string): NeedField | undefined {
  const said = normalize(text);
  return FIELD_FINDERS.find(([, list]) => firstIn(said, list) >= 0)?.[0];
}

const options = (s: NeedState) => ({ areas: s.config.areas, today: s.config.today });
const joined = (a: string | undefined, b: string) => [a, b].filter(Boolean).join(" ").slice(0, NEED_MAX);

/** At a price question: the answer's other details and drivers kept, whatever the question takes. */
function driverDraft(s: NeedState, text: string): NeedDraft {
  const fill = parseNeed(text, options(s));
  return withWordDrivers(fillEmpty(s.draft, fill), fill.words);
}

/** Like the lowest rate on a card: the budget is read back aloud only if the owner said it aloud. */
const budgetReadback = (paise: number, aloud: boolean): Line => ({
  key: "need.got_budget",
  prices: { price: paise },
  ...minAloud(aloud),
});

/** The field now asked, read loosely from the answer; undefined when the answer did not give it. */
function onSlot(s: NeedState, d: NeedDraft, text: string, fill: NeedFill, aloud: boolean): NeedState | undefined {
  switch (s.slot) {
    case NeedSlot.trade: {
      // Changing the trade from the readback needs a trade in the answer, and its words describe the new need. A need
      // addressed to one worker takes only a trade on their card, already set when they have one.
      const editing = s.draft.trade !== undefined && !s.fresh;
      const trade = [fill.trade, editing ? undefined : d.trade].find((tr) => tradeFor(s, tr));
      if (!trade) return undefined;
      const need = editing ? fill.words || d.need : joined(d.need, fill.words);
      return moveOn(s, { ...withTrade(d, trade), need });
    }
    case NeedSlot.detail: {
      const detail = detailAnswer(s, text);
      if (detail === undefined) return undefined;
      if (detail && detail.length > DETAIL_MAX) return retryNeed(s, { key: Say.long });
      return moveOn(s, settledProblem({ ...d, detail }));
    }
    case NeedSlot.arrangement:
      return hearArrangement(s, text);
    case NeedSlot.area: {
      const area = areaIn(text, s.config.areas);
      return area ? moveOn(s, atArea(d, area)) : undefined;
    }
    case NeedSlot.when: {
      if (!fill.day && !fill.time) return undefined;
      const day = fill.day ?? d.day;
      const time = fill.time ?? (fill.day ? undefined : d.time);
      return moveOn(s, { ...d, ...(day ? { day } : {}), time });
    }
    case NeedSlot.budget: {
      const paise = amountIn(text, false);
      if (paise === undefined) return undefined;
      return moveOn(s, { ...d, budget_paise: paise }, [budgetReadback(paise, aloud)]);
    }
    default:
      return undefined;
  }
}

/** A yes or no to "From your last job: … Use it?"; any other answer is read as the question's own. */
function onOffer(s: NeedState, text: string): NeedState | undefined {
  const yes = offered(s) ? yesNo(text) : undefined;
  if (yes === undefined) return undefined;
  return yes ? takeRecalled(s) : answerMyself(s);
}

/** An answer to one of the questions: its field, anything else it said, then a model's gaps; or the question again. */
function onAnswer(s: NeedState, text: string, aloud: boolean, hint: NeedHint): NeedState {
  const offer = onOffer(s, text);
  if (offer) return offer;
  const parsed = parseNeed(text, options(s));
  // A model's trade goes before the lists': "kitchen" is a cook's word in the lists, and a kitchen tap is a plumber's.
  const fill = hint.trade ? { ...parsed, trade: hint.trade } : parsed;
  const draft = withWordDrivers(fillFromHint(fillEmpty(s.draft, fill), hint, fill.words), fill.words);
  const answered = onSlot(s, draft, text, fill, aloud);
  if (answered) return answered;
  // The question stays open, but whatever else the answer gave is kept.
  return { ...retryNeed(s, { key: s.slot === NeedSlot.budget ? Say.againBudget : Say.again }), draft };
}

/** The values a sentence at the readback changes: "make it tomorrow", "Koramangala instead". */
function changedBy(d: NeedDraft, fill: NeedFill): NeedDraft | undefined {
  const next: NeedDraft = {
    ...(fill.trade ? withTrade(d, fill.trade) : d),
    ...(fill.area ? { area: fill.area } : {}),
    // A new day said alone keeps the hour already given; the hour is asked only when there is none.
    ...(fill.day ? { day: fill.day, time: fill.time ?? d.time } : fill.time ? { time: fill.time } : {}),
    ...(fill.budget_paise ? { budget_paise: fill.budget_paise } : {}),
  };
  const same = (Object.keys(next) as (keyof NeedDraft)[]).every((k) => next[k] === d[k]);
  return same ? undefined : next;
}

function onConfirm(s: NeedState, text: string): NeedState {
  const changed = changedBy(s.draft, parseNeed(text, options(s)));
  if (changed) return moveOn(s, changed);
  const yes = yesNo(text);
  const field = needFieldIn(text);
  if (!s.changing && yes === true) return { ...s, slot: NeedSlot.done, notes: [], fresh: false };
  if (field) return editNeed(s, field);
  if (yes === false) return { ...s, changing: !s.changing, notes: [], fresh: false };
  return s.changing ? { ...s, notes: [] } : retryNeed(s, { key: Say.againYesNo });
}

/** The next radius out from the one searched, if any. */
const wider = (s: NeedState) => SEARCH_RADII_KM.find((km) => km > s.radius_km);
const searchAt = (s: NeedState, km: number): NeedState => ({ ...s, radius_km: km, slot: NeedSlot.done, notes: [] });
const changeSomething = (s: NeedState): NeedState => ({ ...s, slot: NeedSlot.confirm, changing: true, notes: [] });

function onNobody(s: NeedState, text: string): NeedState {
  const field = needFieldIn(text);
  if (field) return editNeed({ ...s, slot: NeedSlot.confirm }, field);
  const km = SEARCH_RADII_KM.find((r) => r === countIn(text) && r > s.radius_km);
  const next = km ?? (yesNo(text) === true ? wider(s) : undefined);
  return next === undefined ? changeSomething(s) : searchAt(s, next);
}

/**
 * An answer in words: `aloud` when said, false when typed (a typed budget is never read back aloud). `hint` is what a
 * model read from the same words, already checked; it fills only what the word lists left empty.
 */
export function hearNeed(s: NeedState, text: string, aloud = false, hint: NeedHint = {}): NeedState {
  if (s.switching) return hearSwitch(s, text);
  switch (s.slot) {
    case NeedSlot.confirm:
      return onConfirm(s, text);
    case NeedSlot.scope:
      return hearScope(s, text);
    case NeedSlot.driver:
      return hearDriver(s, text, driverDraft(s, text));
    case NeedSlot.nobody:
      return onNobody(s, text);
    case NeedSlot.done:
    case NeedSlot.found:
      return s;
    case NeedSlot.outside:
      return onAnswer(afterOutside(s), text, aloud, hint);
    default:
      return onAnswer(s, text, aloud, hint);
  }
}

const flag = (value: string): boolean | undefined =>
  value === Pick.yes ? true : value === Pick.no ? false : undefined;

/** A tap on a memory chip: use the offer, answer it myself, or reopen a question the agent filled in. */
function onMemoryPick(s: NeedState, value: string): NeedState | undefined {
  if (value === MemoryPick.use) return takeRecalled(s);
  if (value === MemoryPick.own) return answerMyself(s);
  const redo = REDO.get(value);
  if (redo) return s.filled.includes(redo) ? editNeed(s, redo) : s;
  return undefined;
}

/** A tap on one of the prompt's choices. A value the prompt did not offer changes nothing. */
export function chooseNeed(s: NeedState, value: string): NeedState {
  if (s.switching) return chooseSwitch(s, value);
  if (value === NeedPick.notThis) return { ...afterOutside(s), guessed: false };
  const d = s.draft;
  const memory = onMemoryPick(s, value);
  if (memory) return memory;
  // At work nobody lists yet: the list, or one of the others in its group that have workers (ADR 0061).
  if (s.slot === NeedSlot.outside)
    return value === NeedPick.list ? afterOutside(s) : chooseNeed(afterOutside(s), value);
  if (s.slot === NeedSlot.scope) return chooseScope(s, value) ?? s;
  if (s.slot === NeedSlot.driver) return chooseDriver(s, value) ?? s;
  switch (s.slot) {
    case NeedSlot.trade: {
      if (value === NeedPick.list) return { ...s, fresh: false, notes: [] };
      const browsed = chooseKindPick(s, value);
      if (browsed) return browsed;
      const trade = Trade.options.find((tr) => tr === value);
      return tradeFor(s, trade) ? moveOn(s, { ...withTrade(d, trade), tapped: true }) : s;
    }
    case NeedSlot.detail: {
      if (value === Pick.skip) return moveOn(s, settledProblem({ ...d, detail: null }));
      const yes = flag(value);
      return yes === undefined ? s : moveOn(s, { ...d, detail: yes ? DetailFlag.enum.yes : DetailFlag.enum.no });
    }
    case NeedSlot.arrangement:
      return chooseArrangement(s, value);
    case NeedSlot.area:
      return chooseAddress(s, value) ?? (s.config.areas.some((a) => a.key === value) ? moveOn(s, atArea(d, value)) : s);
    case NeedSlot.when:
      if (needsHour(d)) return chooseHour(s, value) ?? s;
      return WHEN_VALUES.includes(value) ? moveOn(s, { ...d, day: value, time: undefined }) : s;
    case NeedSlot.budget: {
      // The estimate's suggested budget, tapped: kept like a typed one, so it is not read back aloud.
      const budget = value === Pick.suggested ? suggestedBudget(s) : undefined;
      return budget === undefined ? s : moveOn(s, { ...d, budget_paise: budget }, [budgetReadback(budget, false)]);
    }
    case NeedSlot.confirm: {
      if (s.changing) {
        const field = NEED_FIELDS.find((f) => f === value);
        return field ? editNeed(s, field) : s;
      }
      const yes = flag(value);
      if (yes === undefined) return s;
      return yes ? { ...s, slot: NeedSlot.done, notes: [], fresh: false } : { ...s, changing: true, notes: [] };
    }
    case NeedSlot.nobody: {
      if (value === NeedPick.change) return changeSomething(s);
      const km = SEARCH_RADII_KM.find((r) => String(r) === value && r > s.radius_km);
      return km === undefined ? s : searchAt(s, km);
    }
    default:
      return s;
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A date picked on the calendar, "YYYY-MM-DD", at the When question. A past or malformed day changes nothing. */
export function chooseNeedDate(s: NeedState, day: string): NeedState {
  if (s.slot !== NeedSlot.when || !ISO_DAY.test(day) || day < s.config.today) return s;
  return moveOn(s, { ...s.draft, day, time: undefined });
}
