import { t } from "../i18n/t.js";
import { type WorkId, workName } from "../job/work-rates.js";
import { parseAmount } from "./amount.js";
import { advance, type CardDraft, type InterviewState, type Line, Pick, type Prompt, retry, Slot } from "./card.js";
import { asksPrompt, chooseAsks, hearAsks } from "./card-asks.js";
import { chooseTerms, hearTerms, termsPrompt } from "./card-terms.js";
import { missingWorkRate, otherWorks } from "./card-work-list.js";
import { YES_NO } from "./choices.js";
import { yesNo } from "./lexicon.js";

/**
 * Rates per kind of work in the card interview (ADR 0062). A card with more than one kind asks once whether the price
 * is the same for all; on a no, the usual rate for each kind besides the first, whose rate the card already asked.
 * Each one's lowest follows at the share the worker's own lowest is of their usual rate; My card can set it apart.
 */

/** Unclear answers to "the same for all?" settle on yes after two: the card stays as cards always were. */
const UNCLEAR_LIMIT = 2;

/** A kind's name in a line: a trade by its catalog key, a skill in the worker's own words. */
function named(d: CardDraft, work: WorkId): Pick<Line, "names" | "params"> {
  const name = workName(d, work);
  if (!name) return {};
  return "trade" in name ? { names: { work: [`trade.${name.trade}`] } } : { params: { work: name.text } };
}

function samePrompt(s: InterviewState): Prompt {
  const own = s.config.own;
  return { lines: [{ key: "iv.ask.same_rate" }], choices: YES_NO, hints: [t(own, "flag.yes"), t(own, "flag.no")] };
}

function workRatePrompt(s: InterviewState): Prompt {
  const work = missingWorkRate(s.draft);
  return { lines: [{ key: "iv.ask.work_rate", ...(work ? named(s.draft, work) : {}) }], numeric: true, hints: [] };
}

/** Yes keeps one rate for every kind; no asks each kind's rate again, from none. */
function onSame(s: InterviewState, yes: boolean | undefined): InterviewState {
  if (yes === undefined && s.misses + 1 < UNCLEAR_LIMIT)
    return { ...retry(s, { key: "iv.again.yes_no" }), misses: s.misses + 1 };
  const { work_rates: _rates, work_limits: _limits, ...rest } = s.draft;
  if (yes === false) return advance(s, { ...rest, same_rate: false, work_rates: {} });
  return advance(s, { ...rest, same_rate: true });
}

/** An amount for the kind asked; asked again until it is one. */
function keepWorkRate(s: InterviewState, paise: number | undefined): InterviewState {
  const work = missingWorkRate(s.draft);
  if (!work || paise === undefined || paise <= 0) return retry(s, { key: "iv.again.amount" });
  const draft = { ...s.draft, work_rates: { ...s.draft.work_rates, [work]: paise } };
  return advance(s, draft, [{ key: "iv.got_rate", prices: { price: paise } }]);
}

/**
 * The questions the core fields leave: rates per kind here, what the worker needs to know (`card-asks.ts`), and the
 * terms (`card-terms.ts`).
 */
export function restPrompt(s: InterviewState): Prompt {
  if (s.slot === Slot.asks) return asksPrompt();
  if (s.slot === Slot.same_rate) return samePrompt(s);
  if (s.slot === Slot.work_rate) return workRatePrompt(s);
  return termsPrompt(s);
}

export function hearRest(s: InterviewState, text: string): InterviewState {
  if (s.slot === Slot.asks) return hearAsks(s, text);
  if (s.slot === Slot.same_rate) return onSame(s, yesNo(text));
  if (s.slot === Slot.work_rate) return keepWorkRate(s, parseAmount(text));
  return hearTerms(s, text);
}

export function chooseRest(s: InterviewState, value: string): InterviewState {
  if (s.slot === Slot.asks) return chooseAsks(s, value);
  if (s.slot === Slot.same_rate) return value === Pick.yes || value === Pick.no ? onSame(s, value === Pick.yes) : s;
  if (s.slot === Slot.work_rate) return s;
  return chooseTerms(s, value);
}

/** Each kind's own rate in the summary, after the card's rate. */
export const workRatesSummary = (d: CardDraft): Line[] =>
  otherWorks(d).flatMap((work) => {
    const rate = d.same_rate === false ? d.work_rates?.[work] : undefined;
    return rate === undefined ? [] : [{ key: "iv.summary_work_rate", ...named(d, work), prices: { rate } }];
  });
