import { Lang, PAISE_PER_RUPEE, Trade } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { asciiDigits } from "../job/details.js";
import { parseAmount } from "./amount.js";
import { advance, askable, edit, FIELDS, type InterviewState, Pick, retry, Slot } from "./card.js";
import { areaIn, editIntent, type Field, fieldIn, isNone, isSkip, languagesIn, tradesIn, yesNo } from "./lexicon.js";

/**
 * Turning an answer, said, typed or tapped, into the interview's next state: each field's checks, the amount check and
 * readback, and the line about the work, which must not carry anything private onto the public board.
 */

/** Two unclear answers to a yes-or-no question count as no: nothing is agreed to by default. */
const UNCLEAR_LIMIT = 2;
/** An amount this far outside the city's usual range for the trade is checked before it is kept. */
const BAND_SPREAD = 4;
const NO_BAND_LOW = 50 * PAISE_PER_RUPEE;
const NO_BAND_HIGH = 50_000 * PAISE_PER_RUPEE;
const Say = {
  againAmount: "iv.again.amount",
  againYesNo: "iv.again.yes_no",
} as const satisfies Record<string, MessageKey>;

/** Why a line about the work cannot go on the public card. */
const AboutProblem = { private: "private", long: "long" } as const;
type AboutProblem = (typeof AboutProblem)[keyof typeof AboutProblem];

/** What the board keeps of the line about their work. */
const ABOUT_MAX = 300;
/** Ten digits or more, spaced or not: a phone number. */
const PHONE = /(?:\d[\s-]?){9}\d/;
/** Anything shaped like a UPI ID or an email address. */
const HANDLE = /\S@\S/;

/**
 * A line about the work is public, so a phone number or UPI ID in it would bypass the rule that contact is released
 * only after both sides sign. The interview checks the words as said; publishing checks them again, for the My card
 * form too.
 */
export function aboutIsPrivate(text: string): boolean {
  return PHONE.test(asciiDigits(text)) || HANDLE.test(text);
}

function aboutProblem(text: string): AboutProblem | undefined {
  if (aboutIsPrivate(text)) return AboutProblem.private;
  return text.trim().length > ABOUT_MAX ? AboutProblem.long : undefined;
}

function onTrades(s: InterviewState, trades: Trade[]): InterviewState {
  if (trades.length === 0) return retry(s, { key: "iv.again.trade" });
  const keep = askable(trades);
  return advance(s, { ...s.draft, trades, ask_me: (s.draft.ask_me ?? []).filter((k) => keep.includes(k)) });
}

function onArea(s: InterviewState, area: string | undefined): InterviewState {
  return area === undefined ? retry(s, { key: "iv.again.area" }) : advance(s, { ...s.draft, area });
}

/** Whether an amount sits within the usual range for the worker's first trade, or a wide one when there is none. */
function plausible(s: InterviewState, paise: number): boolean {
  const band = s.config.rates.bands.find((b) => b.trade === s.draft.trades?.[0]);
  const low = band ? band.low_paise / BAND_SPREAD : NO_BAND_LOW;
  const high = band ? band.high_paise * BAND_SPREAD : NO_BAND_HIGH;
  return paise >= low && paise <= high;
}

/**
 * Whether a line carrying the lowest rate may be read aloud: only when the owner said the amount aloud, so everyone
 * in earshot heard it already. Typed, it was meant to stay private, and it is shown but never spoken.
 */
export const minAloud = (aloud: boolean): { silent?: true } => (aloud ? {} : { silent: true });

function keepAmount(s: InterviewState, paise: number, aloud: boolean): InterviewState {
  if (s.slot === Slot.rate)
    return advance(s, { ...s.draft, rate_paise: paise }, [{ key: "iv.got_rate", prices: { price: paise } }]);
  const readback = { key: "iv.got_min", prices: { price: paise }, ...minAloud(aloud) } as const;
  return advance(s, { ...s.draft, limit_paise: paise }, [readback]);
}

function onAmount(s: InterviewState, paise: number | undefined, aloud: boolean): InterviewState {
  const cleared = { ...s, pending: undefined, pendingAloud: undefined };
  if (paise === undefined || paise <= 0) return retry(cleared, { key: Say.againAmount });
  const rate = s.draft.rate_paise;
  if (s.slot === Slot.min && rate !== undefined && paise > rate)
    return retry(cleared, { key: "iv.err_min", prices: { price: rate } });
  if (!plausible(s, paise)) return { ...cleared, pending: paise, pendingAloud: aloud, notes: [], fresh: false };
  return keepAmount(cleared, paise, aloud);
}

/**
 * The answer to "Did you mean ₹…?": yes or the same amount keeps it; another amount is checked afresh. A yes keeps the
 * amount as it was given: typed stays quiet even when the yes is spoken.
 */
function onCheck(
  s: InterviewState,
  yes: boolean | undefined,
  paise: number | undefined,
  aloud: boolean,
): InterviewState {
  const pending = s.pending ?? 0;
  const cleared = { ...s, pending: undefined, pendingAloud: undefined };
  if (yes === true || paise === pending)
    return keepAmount(cleared, pending, s.pendingAloud === true || (paise === pending && aloud));
  if (paise !== undefined) return onAmount(s, paise, aloud);
  if (yes === false) return retry(cleared, { key: Say.againAmount });
  return retry(s, { key: Say.againYesNo });
}

function onLanguages(s: InterviewState, named: readonly Lang[] | undefined): InterviewState {
  if (named === undefined && s.misses + 1 < UNCLEAR_LIMIT)
    return { ...retry(s, { key: "iv.again.languages" }), misses: s.misses + 1 };
  // The worker's own language always comes first: their card's free text is written in it.
  const own = s.config.own;
  return advance(s, { ...s.draft, languages: [own, ...(named ?? []).filter((l) => l !== own)] });
}

function onAbout(s: InterviewState, text: string | undefined): InterviewState {
  const { about: _old, ...rest } = s.draft;
  if (text === undefined) return advance(s, rest);
  const problem = aboutProblem(text);
  if (problem === AboutProblem.private) return retry(s, { key: "iv.err_private" });
  if (problem === AboutProblem.long) return retry(s, { key: "iv.err_long" });
  return advance(s, { ...rest, about: text.trim() });
}

function onYesNo(s: InterviewState, yes: boolean | undefined): InterviewState {
  const value = yes ?? (s.misses + 1 >= UNCLEAR_LIMIT ? false : undefined);
  if (value === undefined) return { ...retry(s, { key: Say.againYesNo }), misses: s.misses + 1 };
  if (s.slot === Slot.auto) return advance(s, { ...s.draft, auto: value });
  const keys = askable(s.draft.trades ?? []);
  const key = keys[s.ask];
  const chosen = new Set(s.draft.ask_me);
  if (key && value) chosen.add(key);
  if (key && !value) chosen.delete(key);
  const draft = { ...s.draft, ask_me: keys.filter((k) => chosen.has(k)) };
  if (s.ask + 1 < keys.length) return { ...s, draft, ask: s.ask + 1, misses: 0, notes: [], fresh: false };
  return advance(s, draft);
}

function onConfirm(s: InterviewState, yes: boolean | undefined, field: Field | undefined): InterviewState {
  if (field) return edit(s, field);
  if (yes === true) return { ...s, slot: Slot.done, notes: [], fresh: false };
  if (yes === false) return { ...s, changing: true, notes: [], fresh: false };
  return retry(s, { key: Say.againYesNo });
}

/** Which field to change; a no or "nothing" goes back to the summary and its question. */
function onChange(s: InterviewState, field: Field | undefined, yes: boolean | undefined): InterviewState {
  if (field) return edit(s, field);
  return { ...s, changing: yes !== false, notes: [], fresh: false };
}

/** Languages named, none (an empty list), or undefined when the answer is neither. */
function heardLanguages(text: string): Lang[] | undefined {
  const named = languagesIn(text);
  if (named.length > 0) return named;
  return isNone(text) || yesNo(text) === false ? [] : undefined;
}

/**
 * An answer in words: `aloud` when the owner said it, false when they typed it. It decides only whether the lowest
 * rate is read back aloud; leaving it out keeps that readback quiet.
 */
export function hear(state: InterviewState, text: string, aloud = false): InterviewState {
  switch (state.slot) {
    case Slot.trade:
      return onTrades(state, tradesIn(text));
    case Slot.area:
      return onArea(state, areaIn(text, state.config.areas));
    case Slot.rate:
    case Slot.min:
      return state.pending === undefined
        ? onAmount(state, parseAmount(text), aloud)
        : onCheck(state, yesNo(text), parseAmount(text), aloud);
    case Slot.languages:
      return onLanguages(state, heardLanguages(text));
    case Slot.about:
      return onAbout(state, isSkip(text) ? undefined : text);
    case Slot.ask_first:
    case Slot.auto:
      return onYesNo(state, yesNo(text));
    case Slot.confirm:
      return state.changing
        ? onChange(state, fieldIn(text), yesNo(text))
        : onConfirm(state, yesNo(text), editIntent(text));
    default:
      return state;
  }
}

const flag = (value: string): boolean | undefined =>
  value === Pick.yes ? true : value === Pick.no ? false : undefined;

/** An answer by tapping one of the prompt's choices. A value the prompt did not offer changes nothing. */
export function choose(state: InterviewState, value: string): InterviewState {
  switch (state.slot) {
    case Slot.trade: {
      const trade = Trade.options.find((tr) => tr === value);
      return trade ? onTrades(state, [trade]) : state;
    }
    case Slot.area:
      return state.config.areas.some((a) => a.key === value) ? onArea(state, value) : state;
    case Slot.rate:
    case Slot.min:
      return state.pending !== undefined && flag(value) !== undefined
        ? onCheck(state, flag(value), undefined, false)
        : state;
    case Slot.languages: {
      const lang = Lang.options.find((l) => l === value);
      return lang || value === Pick.none ? onLanguages(state, lang ? [lang] : []) : state;
    }
    case Slot.about:
      return value === Pick.skip ? onAbout(state, undefined) : state;
    case Slot.ask_first:
    case Slot.auto:
      return flag(value) === undefined ? state : onYesNo(state, flag(value));
    case Slot.confirm: {
      if (!state.changing) return flag(value) === undefined ? state : onConfirm(state, flag(value), undefined);
      const field = FIELDS.find((f) => f === value);
      return field ? edit(state, field) : state;
    }
    default:
      return state;
  }
}
