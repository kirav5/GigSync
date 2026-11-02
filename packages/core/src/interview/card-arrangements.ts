import {
  Arrangement,
  type ArrangementRate,
  DEFAULT_ARRANGEMENT,
  hasArrangements,
  mainArrangement,
} from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { parseAmount } from "./amount.js";
import { advance, type CardDraft, type InterviewState, type Line, Pick, type Prompt, retry, Slot } from "./card.js";
import { arrangementSaid } from "./need-arrangement.js";

/**
 * The card interview's arrangements (ADR 0046): for a maid or a driver, which of hourly, one visit, weekly and monthly
 * work they take, then the usual rate for the main one (the longest) with their lowest, as every card asks, then the
 * usual rate for each other one. A card for any other trade never sees these questions.
 */

const A = Arrangement.enum;

/** The rate question for each arrangement, in its unit. */
export const RATE_QUESTION: Readonly<Record<Arrangement, MessageKey>> = {
  [A.hourly]: "iv.ask.rate_hour",
  [A.visit]: "iv.ask.rate_visit",
  [A.weekly]: "iv.ask.rate_week",
  [A.monthly]: "iv.ask.rate_month",
};

/** The card's first trade is priced by arrangement: the card asks which it takes. */
export const arranged = (d: CardDraft): boolean => {
  const first = d.trades?.[0];
  return first !== undefined && hasArrangements(first);
};

/** The arrangements picked, monthly when none was (as every card before arrangements). */
export const pickedOf = (d: CardDraft): Arrangement[] => (d.arrangements?.length ? d.arrangements : [A.monthly]);

/** The arrangement the main rate and lowest are for; undefined for a card not priced by arrangement. */
export const mainOf = (d: CardDraft): Arrangement | undefined =>
  arranged(d) ? (mainArrangement(pickedOf(d)) ?? DEFAULT_ARRANGEMENT) : undefined;

/** The next picked arrangement besides the main one that has no rate yet. */
export function missingRate(d: CardDraft): Arrangement | undefined {
  if (!arranged(d)) return undefined;
  const main = mainOf(d);
  return pickedOf(d).find((a) => a !== main && d.other_rates?.[a] === undefined);
}

/** The arrangement an estimate is wanted for now: the one whose rate is being asked. */
export function askingArrangement(s: InterviewState): Arrangement | undefined {
  return s.slot === Slot.more_rates ? (missingRate(s.draft) ?? mainOf(s.draft)) : mainOf(s.draft);
}

/** The rates the card shows, the main one's from the usual rate; empty for a card not priced by arrangement. */
export function arrangementRates(d: CardDraft): ArrangementRate[] {
  const main = mainOf(d);
  if (!main || d.rate_paise === undefined) return [];
  return pickedOf(d).flatMap((arrangement) => {
    const rate_paise = arrangement === main ? d.rate_paise : d.other_rates?.[arrangement];
    return rate_paise === undefined ? [] : [{ arrangement, rate_paise }];
  });
}

/** "You take work by the hour, by the month." */
const pickedLine = (d: CardDraft): Line => ({
  key: "iv.picked",
  names: { list: (d.arrangements ?? []).map((a) => `arrangement.${a}` as const) },
});

/** Which kinds of work: a chip for each, toggled, and Done once at least one is picked. */
export function arrangementsPrompt(s: InterviewState): Prompt {
  const picked = s.draft.arrangements ?? [];
  return {
    lines: [{ key: "iv.ask.arrangements" }, ...(picked.length > 0 ? [pickedLine(s.draft)] : [])],
    choices: [
      ...Arrangement.options.map((a) => ({ value: a, key: `arrangement.${a}` as const })),
      { value: Pick.yes, key: "iv.done" },
    ],
    hints: [],
  };
}

/** A chip: an arrangement toggles; Done moves on once one is picked. */
export function chooseArrangements(s: InterviewState, value: string): InterviewState {
  const picked = s.draft.arrangements ?? [];
  if (value === Pick.yes)
    return picked.length > 0 ? advance(s, s.draft, [pickedLine(s.draft)]) : retry(s, { key: "iv.err_arrangements" });
  const a = Arrangement.safeParse(value).data;
  if (!a) return s;
  const next = picked.includes(a) ? picked.filter((x) => x !== a) : [...picked, a];
  // In the order the options are listed, so the card reads the same however they were tapped.
  const arrangements = Arrangement.options.filter((x) => next.includes(x));
  return { ...s, draft: { ...s.draft, arrangements }, notes: [], fresh: false };
}

/** Words: every arrangement named ("hourly and monthly") is picked at once, and the interview moves on. */
export function hearArrangements(s: InterviewState, text: string): InterviewState {
  const named = text
    .split(/,|\band\b|और|ಮತ್ತು/u)
    .map((part) => arrangementSaid(part))
    .filter((a): a is Arrangement => a !== undefined);
  if (named.length === 0) return retry(s, { key: "iv.err_arrangements" });
  const arrangements = Arrangement.options.filter((a) => named.includes(a));
  const draft = { ...s.draft, arrangements };
  return advance(s, draft, [pickedLine(draft)]);
}

/** The rate for the next other arrangement. */
export function moreRatePrompt(s: InterviewState): Prompt {
  const a = missingRate(s.draft) ?? A.monthly;
  return { lines: [{ key: RATE_QUESTION[a] }], numeric: true, hints: [] };
}

/** An amount for the arrangement asked; asked again until it is one. */
export function hearMoreRate(s: InterviewState, text: string): InterviewState {
  const a = missingRate(s.draft);
  const paise = parseAmount(text);
  if (!a || paise === undefined || paise <= 0) return retry(s, { key: "iv.again.amount" });
  const draft = { ...s.draft, other_rates: { ...s.draft.other_rates, [a]: paise } };
  return advance(s, draft, [{ key: "iv.got_rate", prices: { price: paise } }]);
}

/** The card's rates in the summary, one line each, after the main rate the summary already gives. */
export const ratesSummary = (d: CardDraft): Line[] =>
  arrangementRates(d)
    .filter((r) => r.arrangement !== mainOf(d))
    .map((r) => ({
      key: "iv.summary_rate",
      names: { arrangement: [`arrangement.${r.arrangement}` as const] },
      prices: { rate: r.rate_paise },
    }));
