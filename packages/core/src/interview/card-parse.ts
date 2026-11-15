import { Lang, Trade } from "@gigsync/protocol";
import { asciiDigits } from "../job/details.js";
import type { WorkMatch } from "../skills/suggest.js";
import { parseAmount } from "./amount.js";
import { advance, askable, type CardDraft, FIELDS, type InterviewState, Pick, retry, Slot } from "./card.js";
import { chooseAlso, hearAlso } from "./card-also.js";
import { onAmount, onCheck, Say } from "./card-amount.js";
import { chooseArrangements, hearArrangements, hearMoreRate, keepMoreRate } from "./card-arrangements.js";
import { chooseWhichRate, edit, editSaid, hearWhichRate, onUnlist } from "./card-edit.js";
import { suggestedAmount } from "./card-estimate.js";
import { chooseFiling, hearFiling } from "./card-guess.js";
import { chooseKind, hearKind } from "./card-kind.js";
import { languagesPicked, toggleLanguage } from "./card-languages.js";
import { choosePriceArrangement } from "./card-price.js";
import { onTrades, onWork } from "./card-work.js";
import { chooseRest, hearRest } from "./card-work-rates.js";
import { areaIn, editIntent, fieldIn, isNone, isSkip, languagesIn, yesNo } from "./lexicon.js";

/**
 * Turning an answer, said, typed or tapped, into the interview's next state: each field's checks (an amount's are in
 * `card-amount.ts`), and the line about the work, which must not carry anything private onto the public board.
 */

/** Two unclear answers to a yes-or-no question count as no: nothing is agreed to by default. */
const UNCLEAR_LIMIT = 2;
/** An amount the price cards answer with: whole paise. */
const PAISE = /^\d+$/;
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

function onArea(s: InterviewState, area: string | undefined): InterviewState {
  if (area === undefined) return retry(s, { key: "iv.again.area" });
  // The point found with their location goes with the old area: left in, publishing would keep that place (`baseOf`).
  const { place: _old, ...rest } = s.draft;
  return advance(s, { ...rest, area });
}

/** The area found with the phone's location: its key, with the place it named (ADR 0045). */
export const keepPlace = (s: InterviewState, area: string, place: NonNullable<CardDraft["place"]>): InterviewState =>
  advance(s, { ...s.draft, area, place });

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

function onConfirm(s: InterviewState, text: string, aloud: boolean): InterviewState {
  const field = editIntent(text);
  if (field) return editSaid(s, field, text, aloud);
  const yes = yesNo(text);
  return yes === undefined ? retry(s, { key: Say.againYesNo }) : onConfirmTap(s, yes);
}

/** Yes to the summary sends the card; no asks what to change. */
const onConfirmTap = (s: InterviewState, yes: boolean): InterviewState =>
  yes ? { ...s, slot: Slot.done, notes: [], fresh: false } : { ...s, changing: true, notes: [], fresh: false };

/** Which field to change; a no or "nothing" goes back to the summary and its question. */
function onChange(s: InterviewState, text: string, aloud: boolean): InterviewState {
  const field = fieldIn(text);
  if (field) return editSaid(s, field, text, aloud);
  return { ...s, changing: yesNo(text) !== false, notes: [], fresh: false };
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
export function hear(state: InterviewState, text: string, aloud = false, kind?: WorkMatch | null): InterviewState {
  switch (state.slot) {
    case Slot.trade:
      if (state.filing) return hearFiling(state, text);
      return state.kind ? hearKind(state, text) : onWork(state, text, kind);
    case Slot.also:
      return hearAlso(state, text);
    case Slot.arrangements:
      return hearArrangements(state, text);
    case Slot.more_rates:
      return hearMoreRate(state, text);
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
      return state.changing ? onChange(state, text, aloud) : onConfirm(state, text, aloud);
    case Slot.which_rate:
      return hearWhichRate(state, text);
    case Slot.unlist:
      return onUnlist(state, yesNo(text));
    default:
      return hearRest(state, text);
  }
}

const flag = (value: string): boolean | undefined =>
  value === Pick.yes ? true : value === Pick.no ? false : undefined;

/** An answer by tapping one of the prompt's choices. A value the prompt did not offer changes nothing. */
export function choose(state: InterviewState, value: string): InterviewState {
  switch (state.slot) {
    case Slot.trade: {
      if (state.filing) return chooseFiling(state, value);
      if (state.kind) return chooseKind(state, value);
      const trade = Trade.options.find((tr) => tr === value);
      return trade ? onTrades(state, [trade]) : state;
    }
    case Slot.also:
      return chooseAlso(state, value);
    case Slot.arrangements:
      return chooseArrangements(state, value);
    case Slot.area:
      return state.config.areas.some((a) => a.key === value) ? onArea(state, value) : state;
    case Slot.rate:
    case Slot.min: {
      if (state.pending !== undefined)
        return flag(value) === undefined ? state : onCheck(state, flag(value), undefined, false);
      // The lowest card's amount, in paise; on the usual rate, a segment of the price card (`card-price.ts`).
      if (PAISE.test(value)) return onAmount(state, Number(value), false);
      return choosePriceArrangement(state, value);
    }
    case Slot.languages: {
      // No other language answers at once; a language ticks on or off; Done answers with those ticked.
      if (value === Pick.none) return onLanguages(state, []);
      if (value === Pick.yes) return onLanguages(state, languagesPicked(state));
      const lang = Lang.options.find((l) => l === value);
      return lang ? toggleLanguage(state, lang) : state;
    }
    case Slot.about:
      return value === Pick.skip ? onAbout(state, undefined) : state;
    case Slot.ask_first:
    case Slot.auto:
      return flag(value) === undefined ? state : onYesNo(state, flag(value));
    case Slot.confirm: {
      if (!state.changing) return flag(value) === undefined ? state : onConfirmTap(state, value === Pick.yes);
      const field = FIELDS.find((f) => f === value);
      return field ? edit(state, field) : state;
    }
    case Slot.more_rates: {
      const suggested = value === Pick.suggested ? suggestedAmount(state, false) : undefined;
      return suggested === undefined ? state : keepMoreRate(state, suggested);
    }
    case Slot.which_rate:
      return chooseWhichRate(state, value);
    case Slot.unlist:
      return flag(value) === undefined ? state : onUnlist(state, flag(value));
    default:
      return chooseRest(state, value);
  }
}
