import { z } from "zod";
import { DetailFlag } from "./lang.js";
import { Trade } from "./trade.js";

/**
 * Scope buckets for rate estimates (ADR 0030 §1): per trade, the structured details that change the price, coarsened
 * so the server's estimate cache and the k-anonymity of shared prices both work per bucket. Never the household's own
 * words: a phone fills these from the toggles and counts it already reads (`QuestionKey`), through the helpers below.
 */

const OTHER = "other";

/** Bedrooms, as "nBHK". */
export const RoomsBucket = z.enum(["bhk1", "bhk2", "bhk3", "bhk4_plus"]);
export type RoomsBucket = z.infer<typeof RoomsBucket>;

/** People a cook cooks for. */
export const PeopleBand = z.enum(["1_2", "3_4", "5_plus"]);
export type PeopleBand = z.infer<typeof PeopleBand>;

/** Meals a day. */
export const MealsBucket = z.enum(["1", "2", "3"]);
export type MealsBucket = z.infer<typeof MealsBucket>;

/** How often a maid comes: every working day, every other day, or once a week. */
export const MaidFrequency = z.enum(["daily", "alternate_days", "weekly"]);
export type MaidFrequency = z.infer<typeof MaidFrequency>;

/** A driver's hours a day. */
export const HoursBand = z.enum(["up_to_6", "7_to_9", "10_plus"]);
export type HoursBand = z.infer<typeof HoursBand>;

/** What a repair visit is for, per trade, with "other" for anything else. */
export const ElectricianProblem = z.enum(["fan", "switch", "light", "wiring", OTHER]);
export type ElectricianProblem = z.infer<typeof ElectricianProblem>;
export const PlumberProblem = z.enum(["leak", "tap", "blockage", "toilet", OTHER]);
export type PlumberProblem = z.infer<typeof PlumberProblem>;
export const CarpenterProblem = z.enum(["door", "repair", "assembly", OTHER]);
export type CarpenterProblem = z.infer<typeof CarpenterProblem>;
export const AcProblem = z.enum(["service", "gas_refill", "install", "repair", OTHER]);
export type AcProblem = z.infer<typeof AcProblem>;

/**
 * Painting: by bedrooms, priced per job; without `rooms`, the estimate is per square foot of the area to paint and the
 * phone multiplies by its own area. `labour_only` "yes" means the household buys the paint.
 */
export const PainterScope = z.object({ rooms: RoomsBucket.optional(), labour_only: DetailFlag });
export type PainterScope = z.infer<typeof PainterScope>;
export const MaidScope = z.object({ rooms: RoomsBucket, frequency: MaidFrequency });
export type MaidScope = z.infer<typeof MaidScope>;
export const CookScope = z.object({ people: PeopleBand, meals: MealsBucket });
export type CookScope = z.infer<typeof CookScope>;
export const DriverScope = z.object({ hours: HoursBand });
export type DriverScope = z.infer<typeof DriverScope>;
export const ElectricianScope = z.object({ problem: ElectricianProblem });
export type ElectricianScope = z.infer<typeof ElectricianScope>;
export const PlumberScope = z.object({ problem: PlumberProblem });
export type PlumberScope = z.infer<typeof PlumberScope>;
export const CarpenterScope = z.object({ problem: CarpenterProblem });
export type CarpenterScope = z.infer<typeof CarpenterScope>;
export const AcScope = z.object({ problem: AcProblem });
export type AcScope = z.infer<typeof AcScope>;

/** Each trade's scope, by trade: what an estimate request for that trade must carry. */
export interface TradeScope {
  electrician: ElectricianScope;
  plumber: PlumberScope;
  maid: MaidScope;
  carpenter: CarpenterScope;
  ac_technician: AcScope;
  painter: PainterScope;
  cook: CookScope;
  driver: DriverScope;
}

const T = Trade.enum;

/**
 * The scope a phone asks about when it knows only the trade: a worker naming their trade on their card. A painter's
 * default is a 2BHK, labour only, because a worker prices their own labour; the paint is the household's cost.
 */
export const DEFAULT_SCOPE: Readonly<TradeScope> = {
  [T.electrician]: { problem: ElectricianProblem.enum.other },
  [T.plumber]: { problem: PlumberProblem.enum.other },
  [T.maid]: { rooms: RoomsBucket.enum.bhk2, frequency: MaidFrequency.enum.daily },
  [T.carpenter]: { problem: CarpenterProblem.enum.other },
  [T.ac_technician]: { problem: AcProblem.enum.other },
  [T.painter]: { rooms: RoomsBucket.enum.bhk2, labour_only: DetailFlag.enum.yes },
  [T.cook]: { people: PeopleBand.enum["3_4"], meals: MealsBucket.enum["2"] },
  [T.driver]: { hours: HoursBand.enum["7_to_9"] },
};

/** Upper bounds of each band, inclusive; anything above the last bound is the top bucket. */
const ROOMS_BOUNDS = [1, 2, 3] as const;
const PEOPLE_BOUNDS = [2, 4] as const;
const HOURS_BOUNDS = [6, 9] as const;
const MAX_MEALS = 3;

function bandOf<B extends string>(value: number, bounds: readonly number[], buckets: readonly B[]): B {
  const at = bounds.findIndex((upper) => value <= upper);
  return buckets[at < 0 ? bounds.length : at] as B;
}

/** Three bedrooms → "bhk3"; five → "bhk4_plus". Zero or less counts as one. */
export const roomsBucket = (rooms: number): RoomsBucket => bandOf(rooms, ROOMS_BOUNDS, RoomsBucket.options);
/** Three people → "3_4". */
export const peopleBand = (people: number): PeopleBand => bandOf(people, PEOPLE_BOUNDS, PeopleBand.options);
/** Hours a day → band; 8 → "7_to_9". */
export const hoursBand = (hours: number): HoursBand => bandOf(hours, HOURS_BOUNDS, HoursBand.options);
/** Meals a day, clamped to 1–3. */
export const mealsBucket = (meals: number): MealsBucket =>
  MealsBucket.options[Math.min(Math.max(Math.round(meals), 1), MAX_MEALS) - 1] as MealsBucket;
