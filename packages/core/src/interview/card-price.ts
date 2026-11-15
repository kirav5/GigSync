import { Arrangement, ISO_WEEKDAYS, type IsoWeekday, PAISE_PER_RUPEE, type TimeWindow } from "@gigsync/protocol";
import { isMonthly } from "../job/when.js";
import type { TermPrefs } from "../job/worker-stance.js";
import { type CardDraft, type InterviewState, type Line, Slot } from "./card.js";
import { onAmount } from "./card-amount.js";
import { arranged, cardArrangements, mainOf } from "./card-arrangements.js";
import { cardEstimate } from "./card-estimate.js";
import { withClock, withTerm } from "./card-terms.js";

/**
 * The price card under "How much do you usually take?" (the design's "Your price"): how the work is priced (by the
 * visit, hour, week or month, as fits it), one amount, the days and the part of the day, answered with one tap. The
 * lowest they take stays its own private question. Typing or saying an amount still answers the question.
 */

const A = Arrangement.enum;

/** The order the card's segments read in, as the design has them: Visit, Hour, then the longer ones. */
const SEGMENT_ORDER: readonly Arrangement[] = [A.visit, A.hourly, A.weekly, A.monthly];

/** One tap of − or + on the amount, by what the price is for: a month moves in ₹500, an hour in ₹10. */
export const AMOUNT_STEP_PAISE: Readonly<Record<Arrangement, number>> = {
  [A.hourly]: 10 * PAISE_PER_RUPEE,
  [A.visit]: 50 * PAISE_PER_RUPEE,
  [A.weekly]: 100 * PAISE_PER_RUPEE,
  [A.monthly]: 500 * PAISE_PER_RUPEE,
};

/** What the price card answers with. No days means every day; no part of the day means any part. */
export interface PriceAnswer {
  arrangement?: Arrangement | undefined;
  paise: number;
  days: readonly IsoWeekday[];
  window?: TimeWindow | undefined;
}

/** The segments the card offers: the arrangements the work fits; none for work done one way (a repair is a visit). */
export const priceArrangements = (d: CardDraft): Arrangement[] => {
  if (!arranged(d)) return [];
  const fits = cardArrangements(d);
  return SEGMENT_ORDER.filter((a) => fits.includes(a));
};

/** What the amount is for: the main arrangement, else the unit the work's rate is asked in; none for own work unpriced. */
export function priceUnit(d: CardDraft): Arrangement | undefined {
  const main = mainOf(d);
  if (main || arranged(d)) return main;
  const first = d.trades?.[0];
  return first && isMonthly(first) ? A.monthly : A.visit;
}

/** "Near you: ₹x–₹y": the going rate from the estimate for this work and arrangement; none without an estimate. */
export function nearYouLine(s: InterviewState): Line | undefined {
  const found = cardEstimate(s);
  return found && { key: "iv.near_you", prices: { low: found.estimate.low_paise, high: found.estimate.high_paise } };
}

/** The card priced by one arrangement: the one picked becomes the card's only arrangement, so its rate is the main. */
function pricedBy(d: CardDraft, arrangement: Arrangement | undefined): CardDraft {
  if (!arrangement || !priceArrangements(d).includes(arrangement)) return d;
  const { other_rates: _others, ...rest } = d;
  return { ...rest, arrangements: [arrangement] };
}

/** A segment tapped: the question stays open, now in that arrangement's unit (and its estimate). */
export function choosePriceArrangement(s: InterviewState, value: string): InterviewState {
  const arrangement = Arrangement.safeParse(value).data;
  if (s.slot !== Slot.rate || !arrangement || !priceArrangements(s.draft).includes(arrangement)) return s;
  return { ...s, draft: pricedBy(s.draft, arrangement), fresh: false };
}

/**
 * The days and part of the day on the card. Every day, or none ticked, is left unset (every day, as a card always
 * was); a part of the day replaces hours on the clock, since the card would otherwise show both.
 */
function withWhen(prefs: TermPrefs, answer: PriceAnswer): TermPrefs {
  const days = ISO_WEEKDAYS.filter((d) => answer.days.includes(d));
  const every = days.length === 0 || days.length === ISO_WEEKDAYS.length;
  const dated = withTerm(prefs, "days", every ? undefined : days);
  return answer.window ? { ...withClock(dated), windows: [answer.window] } : withTerm(dated, "windows", undefined);
}

/** The card's answer written into the draft, before its amount is checked like any other (`card-parse.ts`). */
const pricedDraft = (d: CardDraft, answer: PriceAnswer): CardDraft => {
  const priced = pricedBy(d, answer.arrangement);
  return { ...priced, terms: withWhen(priced.terms ?? {}, answer) };
};

/** The price card answered: the draft as it says, then its amount checked and kept like a typed one. */
export const keepPrice = (s: InterviewState, answer: PriceAnswer): InterviewState =>
  onAmount({ ...s, draft: pricedDraft(s.draft, answer) }, answer.paise, false);

/** The parts of the day set on the card, in the summary when no hours on the clock say it better. */
export function windowsSummary(d: CardDraft): Line[] {
  const { from, windows } = d.terms ?? {};
  if (from !== undefined || !windows?.length) return [];
  return [{ key: "iv.summary_window", names: { window: windows.map((w) => `terms.window.${w}` as const) } }];
}
