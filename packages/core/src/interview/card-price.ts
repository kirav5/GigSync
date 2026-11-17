import {
  Arrangement,
  ISO_WEEKDAYS,
  type IsoWeekday,
  mainArrangement,
  PAISE_PER_RUPEE,
  type TimeWindow,
} from "@gigsync/protocol";
import { isMonthly } from "../job/when.js";
import type { TermPrefs } from "../job/worker-stance.js";
import { type CardDraft, type InterviewState, type Line, Slot } from "./card.js";
import { onAmount } from "./card-amount.js";
import { arranged, cardArrangements, mainOf, pickedOf } from "./card-arrangements.js";
import { cardEstimate } from "./card-estimate.js";
import { withClock, withTerm } from "./card-terms.js";

/**
 * The price card under "How much do you usually take?" (the design's "Your price"): each way they take the work (by
 * the visit, hour, week or month, as fits it), ticked, with an amount for each; the days and the part of the day;
 * answered with one tap. The longest way ticked is the main rate, whose lowest stays its own private question; the
 * others' lowest follow at the same share (ADR 0046 §2). Typing or saying an amount still answers the question.
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

/** One amount on the price card, for the way it was ticked; none for work priced one way. */
export interface PriceRate {
  arrangement?: Arrangement | undefined;
  paise: number;
}

/** What the price card answers with. No days means every day; no part of the day means any part. */
export interface PriceAnswer {
  rates: readonly PriceRate[];
  days: readonly IsoWeekday[];
  window?: TimeWindow | undefined;
}

/** The ways the card offers to tick: the arrangements the work fits; none for work done one way (a repair is a visit). */
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

/**
 * The ways ticked on the card: those the draft takes, else the one a card of the work has always meant (monthly for a
 * maid), else the first the work fits (a visit, for work of their own). Never none: the card is priced some way.
 */
export function pricePicked(d: CardDraft): Arrangement[] {
  const fits = priceArrangements(d);
  const picked = fits.filter((a) => pickedOf(d).includes(a));
  return picked.length > 0 ? picked : fits.slice(0, 1);
}

/** The card's arrangements as these, in the order the options are listed, keeping the rates of those still ticked. */
function withPicked(d: CardDraft, picked: readonly Arrangement[]): CardDraft {
  const arrangements = Arrangement.options.filter((a) => picked.includes(a));
  const kept = Object.entries(d.other_rates ?? {}).filter(([a]) => picked.some((p) => p === a));
  const { other_rates: _others, ...rest } = d;
  return { ...rest, arrangements, ...(kept.length > 0 ? { other_rates: Object.fromEntries(kept) } : {}) };
}

/**
 * A way tapped: ticked on or off, the question still open, its unit and estimate now the main way's. The last one
 * ticked stays: a card is priced some way.
 */
export function choosePriceArrangement(s: InterviewState, value: string): InterviewState {
  const arrangement = Arrangement.safeParse(value).data;
  if (s.slot !== Slot.rate || !arrangement || !priceArrangements(s.draft).includes(arrangement)) return s;
  const picked = pricePicked(s.draft);
  const next = picked.includes(arrangement) ? picked.filter((a) => a !== arrangement) : [...picked, arrangement];
  return next.length === 0 ? s : { ...s, draft: withPicked(s.draft, next), fresh: false };
}

/** The card priced by the ways ticked: the longest one's amount is the main rate, each other's its own rate. */
function pricedBy(d: CardDraft, rates: readonly PriceRate[]): { draft: CardDraft; paise: number | undefined } {
  const fits = priceArrangements(d);
  const ticked = rates.filter((r) => r.arrangement !== undefined && fits.includes(r.arrangement));
  const main = mainArrangement(ticked.flatMap((r) => (r.arrangement ? [r.arrangement] : [])));
  if (!main) return { draft: d, paise: rates[0]?.paise };
  const others = ticked.filter((r) => r.arrangement !== main).map((r) => [r.arrangement, r.paise]);
  const picked = withPicked(
    d,
    ticked.flatMap((r) => (r.arrangement ? [r.arrangement] : [])),
  );
  const draft = { ...picked, ...(others.length > 0 ? { other_rates: Object.fromEntries(others) } : {}) };
  return { draft, paise: ticked.find((r) => r.arrangement === main)?.paise };
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

/** The price card answered: the draft as it says, then the main amount checked and kept like a typed one. */
export function keepPrice(s: InterviewState, answer: PriceAnswer): InterviewState {
  const { draft, paise } = pricedBy(s.draft, answer.rates);
  return onAmount({ ...s, draft: { ...draft, terms: withWhen(draft.terms ?? {}, answer) } }, paise, false);
}

/** The parts of the day set on the card, in the summary when no hours on the clock say it better. */
export function windowsSummary(d: CardDraft): Line[] {
  const { from, windows } = d.terms ?? {};
  if (from !== undefined || !windows?.length) return [];
  return [{ key: "iv.summary_window", names: { window: windows.map((w) => `terms.window.${w}` as const) } }];
}
