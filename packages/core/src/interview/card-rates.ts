import { PAISE_PER_RUPEE, type RateCard, SEED_SIGNER, type Trade } from "@gigsync/protocol";
import { LEGAL_MINIMUM, type LegalMinimum } from "../job/city-rates.js";
import { isMonthly } from "../job/when.js";
import type { Line } from "./card.js";
import { isMessageKey } from "./choices.js";

/**
 * What a worker new to the city is shown under the rate questions: the usual pay for their work there, from the city
 * pack's rate card, and the legal minimum where the pack names one. Every number comes from the card or the law, never
 * from a model. The lines are public information, so they are read aloud with the question.
 */

/** The card's city by its catalog key, so it shows in the reader's script; as the card writes it when there is none. */
function city(rates: RateCard): Pick<Line, "names" | "params"> {
  const key = `city.${rates.city.toLowerCase()}`;
  return isMessageKey(key) ? { names: { city: [key] } } : { params: { city: rates.city } };
}

/** The legal minimum a month for the part-time hours the trade's band is for. */
export interface MonthlyFloor {
  hours: number;
  month_paise: number;
}

/**
 * A monthly floor from the day rate, rounded up to the rupee: rounding down would show a minimum below the law's.
 * Only for the card's city and a monthly trade; a per-visit question never gets a monthly number under it.
 */
export function legalMonthly(
  rates: RateCard,
  trade: Trade,
  law: LegalMinimum = LEGAL_MINIMUM,
): MonthlyFloor | undefined {
  const day = law.trades[trade];
  if (!day || law.city !== rates.city || !isMonthly(trade)) return undefined;
  const paise = (day.day_paise * day.hours * law.days_per_month) / law.day_hours;
  return { hours: day.hours, month_paise: Math.ceil(paise / PAISE_PER_RUPEE) * PAISE_PER_RUPEE };
}

/**
 * The usual range for one trade in the card's city, in the unit its rate is asked in (a month for the monthly trades,
 * a visit for the rest), then the legal minimum when known; a trade without a band says so instead of a range.
 */
export function rateHint(rates: RateCard, trade: Trade, law: LegalMinimum = LEGAL_MINIMUM): Line[] {
  const band = rates.bands.find((b) => b.trade === trade);
  const where = city(rates);
  const names = { trade: [`trade.${trade}` as const], ...where.names };
  const range: Line = band
    ? {
        key: isMonthly(trade) ? "iv.band_month" : "iv.band_visit",
        names,
        ...(where.params ? { params: where.params } : {}),
        prices: { low: band.low_paise, high: band.high_paise },
      }
    : { key: "iv.band_none", names: { trade: names.trade } };
  return [range, ...legalLines(rates, trade, law)];
}

/** The legal minimum for one trade as a line, when the law names one for the card's city. */
export function legalLines(rates: RateCard, trade: Trade, law: LegalMinimum = LEGAL_MINIMUM): Line[] {
  const floor = legalMonthly(rates, trade, law);
  return floor
    ? [
        {
          key: "iv.legal_min",
          names: { trade: [`trade.${trade}` as const] },
          params: { hours: floor.hours },
          prices: { min: floor.month_paise },
        },
      ]
    : [];
}

/** The note that the card is a seed nobody has checked yet, when any of the trades has a band from it. */
export const rateNote = (rates: RateCard, trades: readonly Trade[]): Line[] =>
  rates.signed_by === SEED_SIGNER && rates.bands.some((b) => trades.includes(b.trade)) ? [{ key: "iv.band_seed" }] : [];

/**
 * What is shown under a rate question for the worker's first trade. The usual rate gets the range, the minimum and the
 * note; the least-they-will-take question, asked right after, gets only the legal minimum, so a voice user does not hear
 * the same range twice in a row.
 */
export function rateLines(rates: RateCard, trade: Trade | undefined, least = false): Line[] {
  if (!trade) return [];
  return least ? legalLines(rates, trade) : [...rateHint(rates, trade), ...rateNote(rates, [trade])];
}
