import { DetailFlag, QuestionKey, Trade } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { countIn, YES_NO_QUESTIONS } from "../job/details.js";
import { EVERY_DAY } from "../job/when.js";
import { Pick } from "./card.js";
import { minAloud } from "./card-parse.js";
import { areaIn, isSkip, yesNo } from "./lexicon.js";
import {
  DayWord,
  editNeed,
  firstQuestion,
  moveOn,
  NEED_FIELDS,
  type NeedDraft,
  type NeedField,
  NeedSlot,
  type NeedState,
  retryNeed,
  SEARCH_RADII_KM,
  withTrade,
} from "./need.js";
import type { NeedHint } from "./need-model.js";
import { amountIn, DETAIL_MAX, type NeedFill, parseNeed, withoutMoney } from "./need-parse.js";
import { NEED_FIELD_WORDS } from "./need-words.js";
import { finder, firstIn, normalize } from "./normalize.js";

/**
 * Turning an answer, said, typed or tapped, into the need interview's next state. Every answer is read whole: one
 * that also names the day or the budget fills those too, so the interview never asks what it was already told.
 */

/** What the tap choices carry besides trades, areas, days, radii and fields. */
export const NeedPick = { date: "date", change: "change", remembered: "remembered" } as const;
/** The When chips' values, in the order shown. */
const WHEN_VALUES: readonly string[] = [DayWord.today, DayWord.tomorrow, EVERY_DAY];
/** What `JobRequest.need` holds. */
const NEED_MAX = 1000;
const Say = {
  again: "need.again",
  againBudget: "need.again_budget",
  againYesNo: "iv.again.yes_no",
  long: "need.err_long",
} as const satisfies Record<string, MessageKey>;
const FIELD_FINDERS = NEED_FIELDS.map((f) => [f, NEED_FIELD_WORDS[f].map(finder)] as const);

/** The field an answer names ("बजट" is the budget). */
export function needFieldIn(text: string): NeedField | undefined {
  const said = normalize(text);
  return FIELD_FINDERS.find(([, list]) => firstIn(said, list) >= 0)?.[0];
}

const options = (s: NeedState) => ({ areas: s.config.areas, today: s.config.today });
const joined = (a: string | undefined, b: string) => [a, b].filter(Boolean).join(" ").slice(0, NEED_MAX);

/** The sentence's other answers, each only where nothing was given yet. */
function fillEmpty(d: NeedDraft, fill: NeedFill): NeedDraft {
  const seen = { ...fill.details, ...d.seen };
  let next: NeedDraft = { ...d, seen };
  const first = firstQuestion(next.trade);
  if (first && next.detail === undefined && seen[first]) next = { ...next, detail: seen[first] };
  if (fill.trade && !next.trade) next = withTrade(next, fill.trade);
  return {
    ...next,
    area: next.area ?? fill.area,
    day: next.day ?? fill.day,
    time: next.time ?? fill.time,
    budget_paise: next.budget_paise ?? fill.budget_paise,
  };
}

/** A model's reading, only where the words lists found nothing (`understandNeed` has checked every value). */
function fillFromHint(d: NeedDraft, hint: NeedHint, words: string): NeedDraft {
  const problem = QuestionKey.enum.problem;
  const seen = hint.problem && words && !d.seen[problem] ? { ...d.seen, [problem]: words } : d.seen;
  const next = { ...d, seen };
  return fillEmpty(next, { ...hint, details: {}, words });
}

/** The answer to the trade's first question: a yes or no for a yes-or-no question, else the owner's words. */
function detailAnswer(s: NeedState, text: string): string | null | undefined {
  const question = firstQuestion(s.draft.trade);
  if (question && YES_NO_QUESTIONS.has(question)) {
    const yes = yesNo(text);
    return yes === undefined ? undefined : yes ? DetailFlag.enum.yes : DetailFlag.enum.no;
  }
  return isSkip(text) ? null : withoutMoney(text) || undefined;
}

/** The field now asked, read loosely from the answer; undefined when the answer did not give it. */
function onSlot(s: NeedState, d: NeedDraft, text: string, fill: NeedFill, aloud: boolean): NeedState | undefined {
  switch (s.slot) {
    case NeedSlot.trade: {
      // Changing the trade from the readback needs a trade in the answer, and its words describe the new need.
      const editing = s.draft.trade !== undefined;
      const trade = fill.trade ?? (editing ? undefined : d.trade);
      if (!trade) return undefined;
      const need = editing ? fill.words || d.need : joined(d.need, fill.words);
      return moveOn(s, { ...withTrade(d, trade), need });
    }
    case NeedSlot.detail: {
      const detail = detailAnswer(s, text);
      if (detail === undefined) return undefined;
      if (detail && detail.length > DETAIL_MAX) return retryNeed(s, { key: Say.long });
      return moveOn(s, { ...d, detail });
    }
    case NeedSlot.area: {
      const area = areaIn(text, s.config.areas);
      return area ? moveOn(s, { ...d, area }) : undefined;
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
      // Like the lowest rate on a card: read back aloud only if the owner said it aloud.
      const readback = { key: "need.got_budget", prices: { price: paise }, ...minAloud(aloud) } as const;
      return moveOn(s, { ...d, budget_paise: paise }, [readback]);
    }
    default:
      return undefined;
  }
}

/** An answer to one of the questions: its field, anything else it said, then a model's gaps; or the question again. */
function onAnswer(s: NeedState, text: string, aloud: boolean, hint: NeedHint): NeedState {
  const fill = parseNeed(text, options(s));
  const draft = fillFromHint(fillEmpty(s.draft, fill), hint, fill.words);
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
    ...(fill.day ? { day: fill.day, time: fill.time } : fill.time ? { time: fill.time } : {}),
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
  switch (s.slot) {
    case NeedSlot.confirm:
      return onConfirm(s, text);
    case NeedSlot.nobody:
      return onNobody(s, text);
    case NeedSlot.done:
    case NeedSlot.found:
      return s;
    default:
      return onAnswer(s, text, aloud, hint);
  }
}

const flag = (value: string): boolean | undefined =>
  value === Pick.yes ? true : value === Pick.no ? false : undefined;

/** What the owner gave last time for the trade's first question, from the agent's memory. */
export function rememberedDetail(s: NeedState): string | undefined {
  const first = firstQuestion(s.draft.trade);
  return first ? s.config.remembered?.facts[first] : undefined;
}

/** A tap on one of the prompt's choices. A value the prompt did not offer changes nothing. */
export function chooseNeed(s: NeedState, value: string): NeedState {
  const d = s.draft;
  switch (s.slot) {
    case NeedSlot.trade: {
      const trade = Trade.options.find((tr) => tr === value);
      return trade ? moveOn(s, withTrade(d, trade)) : s;
    }
    case NeedSlot.detail: {
      if (value === Pick.skip) return moveOn(s, { ...d, detail: null });
      const remembered = rememberedDetail(s);
      if (value === NeedPick.remembered && remembered) return moveOn(s, { ...d, detail: remembered });
      const yes = flag(value);
      return yes === undefined ? s : moveOn(s, { ...d, detail: yes ? DetailFlag.enum.yes : DetailFlag.enum.no });
    }
    case NeedSlot.area:
      return s.config.areas.some((a) => a.key === value) ? moveOn(s, { ...d, area: value }) : s;
    case NeedSlot.when:
      return WHEN_VALUES.includes(value) ? moveOn(s, { ...d, day: value }) : s;
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
  return moveOn(s, { ...s.draft, day });
}
