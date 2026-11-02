import {
  ARRANGEMENT_UNIT,
  Arrangement,
  City,
  DEFAULT_ARRANGEMENT,
  hasArrangements,
  type PriceUnit,
  Trade,
} from "@gigsync/protocol";
import { ESTIMATE_UNIT, GIGSYNC_SEED, type PaiseRange, type RateCardEntry, rateCardEntry } from "./driver-rates.js";

/**
 * The rate card entries for work that is not by the month (ADR 0046). Monthly keeps the city card's entry
 * (`driver-rates.ts`); these are GigSync seeds, unverified, from public service prices as the founders read them on
 * 2026-11-02, and say so wherever they are shown. Each is for the base job its comment states, which the drivers of
 * `ARRANGEMENT_DRIVERS` scale.
 */

const RUPEE = 100;
const rupees = (low: number, typical: number, high: number): PaiseRange => ({
  low: low * RUPEE,
  typical: typical * RUPEE,
  high: high * RUPEE,
});
const seed = (unit: PriceUnit, range: PaiseRange): RateCardEntry => ({ unit, range, sources: [GIGSYNC_SEED] });

const A = Arrangement.enum;
const T = Trade.enum;
type OtherArrangement = Exclude<Arrangement, typeof DEFAULT_ARRANGEMENT>;

/**
 * Bengaluru. Maid: an hour of house help; one visit to a 2BHK, sweeping, mopping and dishes; a week of three such
 * visits. Driver: an hour on call in the family's car; one trip, per hour of it; a week of six days, per hour a day
 * (as the monthly figure is). Every figure a seed until GigSync's own jobs of the arrangement pass the 10/10/10 rule.
 */
const OTHER_RATES: Readonly<
  Partial<Record<City, Partial<Record<Trade, Readonly<Record<OtherArrangement, RateCardEntry>>>>>>
> = {
  [City.enum.bengaluru]: {
    [T.maid]: {
      [A.hourly]: seed(ARRANGEMENT_UNIT.hourly, rupees(100, 150, 250)),
      [A.visit]: seed(ARRANGEMENT_UNIT.visit, rupees(300, 400, 600)),
      [A.weekly]: seed(ARRANGEMENT_UNIT.weekly, rupees(500, 750, 1100)),
    },
    [T.driver]: {
      [A.hourly]: seed(ARRANGEMENT_UNIT.hourly, rupees(150, 200, 300)),
      [A.visit]: seed(ARRANGEMENT_UNIT.visit, rupees(125, 160, 225)),
      [A.weekly]: seed(ARRANGEMENT_UNIT.weekly, rupees(550, 650, 800)),
    },
  },
};

/** The arrangement a job of `trade` is priced in: the one asked for, monthly when none was or the trade has none. */
export const arrangementOf = (trade: Trade, asked: Arrangement | undefined): Arrangement =>
  asked && hasArrangements(trade) ? asked : DEFAULT_ARRANGEMENT;

/** A city's card entry for a trade in an arrangement; monthly is the city card's own entry. */
export function arrangementEntry(city: City, trade: Trade, asked?: Arrangement): RateCardEntry | undefined {
  const arrangement = arrangementOf(trade, asked);
  if (arrangement === DEFAULT_ARRANGEMENT) return rateCardEntry(city, trade);
  return OTHER_RATES[city]?.[trade]?.[arrangement];
}

/** What an estimate is given in: the arrangement's unit for the trades priced by arrangement, else the trade's own. */
export const estimateUnit = (trade: Trade, asked?: Arrangement): PriceUnit =>
  asked && hasArrangements(trade) ? ARRANGEMENT_UNIT[asked] : ESTIMATE_UNIT[trade];
