import { z } from "zod";
import { DriverName, PriceUnit, TRADE_DRIVERS } from "./estimate-drivers.js";
import { Paise } from "./payment.js";
import { Trade } from "./trade.js";

/**
 * How long a job is for (ADR 0046): a few hours, one visit, some days a week, or every month. Household work is sold
 * all four ways; each has its own price unit, its own rate on a worker's card and its own estimate.
 */
export const Arrangement = z.enum(["hourly", "visit", "weekly", "monthly"]);
export type Arrangement = z.infer<typeof Arrangement>;

const A = Arrangement.enum;
const T = Trade.enum;
const U = PriceUnit.enum;
const D = DriverName.enum;

/** Every job was monthly before arrangements, and a card or record without one still is. */
export const DEFAULT_ARRANGEMENT = A.monthly;

/** The trades whose work is asked and priced by arrangement; every other trade is priced as it always was. */
export const ARRANGEMENT_TRADES: readonly Trade[] = [T.maid, T.driver];

export const hasArrangements = (trade: Trade): boolean => ARRANGEMENT_TRADES.includes(trade);

/** What a price is per, for each arrangement. */
export const ARRANGEMENT_UNIT: Readonly<Record<Arrangement, PriceUnit>> = {
  [A.hourly]: U.hour,
  [A.visit]: U.visit,
  [A.weekly]: U.week,
  [A.monthly]: U.month,
};

/**
 * The arrangement a worker's main rate is for: the longest one they take (monthly, then weekly, visit, hourly), so a
 * worker who takes monthly work keeps the monthly rate their card always had.
 */
export const MAIN_ORDER: readonly Arrangement[] = [A.monthly, A.weekly, A.visit, A.hourly];

export const mainArrangement = (picked: readonly Arrangement[]): Arrangement | undefined =>
  MAIN_ORDER.find((a) => picked.includes(a));

/**
 * The drivers that move a price in each arrangement. An hour of a maid's time costs the same whatever the flat; a visit
 * is priced by rooms and tasks; a week by how many days too. Monthly is the trade's own list (ADR 0041).
 */
export const ARRANGEMENT_DRIVERS: Readonly<
  Partial<Record<Trade, Readonly<Record<Arrangement, readonly DriverName[]>>>>
> = {
  [T.maid]: {
    [A.hourly]: [],
    [A.visit]: [D.rooms, D.tasks],
    [A.weekly]: [D.days_week, D.rooms, D.tasks],
    [A.monthly]: TRADE_DRIVERS[T.maid],
  },
  [T.driver]: {
    [A.hourly]: [D.vehicle],
    [A.visit]: [D.hours, D.vehicle],
    [A.weekly]: [D.hours, D.days_week, D.vehicle],
    [A.monthly]: TRADE_DRIVERS[T.driver],
  },
};

/** The drivers that price a job of `trade` in `arrangement`; any other trade's own list. */
export const pricedDrivers = (trade: Trade, arrangement: Arrangement = DEFAULT_ARRANGEMENT): readonly DriverName[] =>
  ARRANGEMENT_DRIVERS[trade]?.[arrangement] ?? TRADE_DRIVERS[trade];

/** Every driver a trade has in any arrangement: what a request may carry and the server keeps. */
export const allDrivers = (trade: Trade): readonly DriverName[] => [
  ...new Set([...TRADE_DRIVERS[trade], ...Object.values(ARRANGEMENT_DRIVERS[trade] ?? {}).flat()]),
];

/** One arrangement a worker takes, with their usual rate for it, as the board shows it. */
export const ArrangementRate = z.object({ arrangement: Arrangement, rate_paise: Paise });
export type ArrangementRate = z.infer<typeof ArrangementRate>;

/** A card's arrangements: each at most once. */
export const ArrangementRates = z
  .array(ArrangementRate)
  .min(1)
  .max(Arrangement.options.length)
  .refine((rs) => new Set(rs.map((r) => r.arrangement)).size === rs.length, "one rate per arrangement");
export type ArrangementRates = z.infer<typeof ArrangementRates>;
