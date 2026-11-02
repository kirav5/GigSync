import { z } from "zod";
import { AcProblem, CarpenterProblem, ElectricianProblem, MaidFrequency, PlumberProblem } from "./estimate-scope.js";
import { MaterialsBy } from "./terms.js";
import { Trade } from "./trade.js";

/**
 * Price drivers (ADR 0041 §1): per trade, the facts that move a job's price, as structured values, never words. A phone
 * parses the owner's words into these, asks for the ones that widen the range most, and sends only the values; a driver
 * the owner does not know is left out, and the estimate assumes it and says so. Each driver's units, default and the
 * spread assumed when it is unknown are in `estimate-driver-specs.ts`.
 */

/**
 * What a price is per (ADR 0041 §3): a square foot, a month, one visit, a day, an hour or the whole job. Per-unit rates
 * are kept in these units; an estimate is given in them too (`RateUnit` is the same enum, its older name).
 */
export const PriceUnit = z.enum(["job", "sqft", "day", "month", "visit", "hour", "week"]);
export type PriceUnit = z.infer<typeof PriceUnit>;

/** Which walls are painted. */
export const Surface = z.enum(["inside", "outside", "both"]);
export type Surface = z.infer<typeof Surface>;

/** The kind of home: a flat in a building, an independent house, or a villa (larger rooms, its own compound). */
export const HouseType = z.enum(["flat", "independent", "villa"]);
export type HouseType = z.infer<typeof HouseType>;

/** The wall finish: plain emulsion, or a texture (more labour and material per square foot). */
export const Finish = z.enum(["plain", "texture"]);
export type Finish = z.infer<typeof Finish>;

/** A maid's work: sweeping and mopping, those plus dishes, or the full house (bathrooms and laundry too). */
export const MaidTasks = z.enum(["sweep_mop", "sweep_mop_dishes", "full"]);
export type MaidTasks = z.infer<typeof MaidTasks>;

/** The car a driver drives. */
export const Vehicle = z.enum(["hatchback", "sedan", "suv"]);
export type Vehicle = z.infer<typeof Vehicle>;

/** Every driver's name, across trades; each trade uses some (`TRADE_DRIVERS`). */
export const DriverName = z.enum([
  "area_sqft",
  "surface",
  "floors",
  "house_type",
  "paint_by",
  "finish",
  "people",
  "meals",
  "days_week",
  "rooms",
  "frequency",
  "tasks",
  "hours",
  "vehicle",
  "problem",
  "points",
]);
export type DriverName = z.infer<typeof DriverName>;

/** Floor-area bands in sq ft, upper bounds inclusive: what a job record keeps, never the figure a household gave. */
const AREA_BOUNDS = [800, 1200, 1800, 2500, 3500, 5000] as const;
export const AreaBand = z.enum(["1_800", "801_1200", "1201_1800", "1801_2500", "2501_3500", "3501_5000", "5001_plus"]);
export type AreaBand = z.infer<typeof AreaBand>;

/** 3,000 sq ft → "2501_3500". */
export function areaBand(sqft: number): AreaBand {
  const at = AREA_BOUNDS.findIndex((upper) => sqft <= upper);
  return AreaBand.options[at < 0 ? AREA_BOUNDS.length : at] as AreaBand;
}

/** Limits on the counts a phone may send; beyond them a value is a typo, not a job. */
export const DriverLimit = {
  area_sqft: { min: 100, max: 50_000 },
  floors: { min: 1, max: 6 },
  people: { min: 1, max: 20 },
  meals: { min: 1, max: 3 },
  days_week: { min: 1, max: 7 },
  rooms: { min: 1, max: 12 },
  hours: { min: 1, max: 12 },
  points: { min: 1, max: 30 },
} as const;

const count = (limit: { min: number; max: number }) => z.number().int().min(limit.min).max(limit.max).optional();
const L = DriverLimit;

/**
 * Painting. `area_sqft` is the home's floor area (what people know), not the wall area; `rooms` its bedrooms (as
 * "nBHK"); `paint_by` who buys the paint.
 */
export const PainterDrivers = z.strictObject({
  area_sqft: count(L.area_sqft),
  rooms: count(L.rooms),
  surface: Surface.optional(),
  floors: count(L.floors),
  house_type: HouseType.optional(),
  paint_by: MaterialsBy.optional(),
  finish: Finish.optional(),
});
export type PainterDrivers = z.infer<typeof PainterDrivers>;

export const CookDrivers = z.strictObject({
  people: count(L.people),
  meals: count(L.meals),
  days_week: count(L.days_week),
});
export type CookDrivers = z.infer<typeof CookDrivers>;

export const MaidDrivers = z.strictObject({
  rooms: count(L.rooms),
  frequency: MaidFrequency.optional(),
  tasks: MaidTasks.optional(),
  /** Only for work some days a week (ADR 0046); a monthly maid's visits are `frequency`. */
  days_week: count(L.days_week),
});
export type MaidDrivers = z.infer<typeof MaidDrivers>;

/** The driver trade's own drivers: hours a day, days a week, the car. */
export const ChauffeurDrivers = z.strictObject({
  hours: count(L.hours),
  days_week: count(L.days_week),
  vehicle: Vehicle.optional(),
});
export type ChauffeurDrivers = z.infer<typeof ChauffeurDrivers>;

/** A repair visit: the problem, and how many points (switches, taps, doors, AC units) it covers. */
const repair = <E extends z.ZodEnum>(problem: E) =>
  z.strictObject({ problem: problem.optional(), points: count(L.points) });
export const ElectricianDrivers = repair(ElectricianProblem);
export type ElectricianDrivers = z.infer<typeof ElectricianDrivers>;
export const PlumberDrivers = repair(PlumberProblem);
export type PlumberDrivers = z.infer<typeof PlumberDrivers>;
export const CarpenterDrivers = repair(CarpenterProblem);
export type CarpenterDrivers = z.infer<typeof CarpenterDrivers>;
export const AcDrivers = repair(AcProblem);
export type AcDrivers = z.infer<typeof AcDrivers>;

/** Each trade's drivers, by trade. */
export interface TradeDrivers {
  electrician: ElectricianDrivers;
  plumber: PlumberDrivers;
  maid: MaidDrivers;
  carpenter: CarpenterDrivers;
  ac_technician: AcDrivers;
  painter: PainterDrivers;
  cook: CookDrivers;
  driver: ChauffeurDrivers;
}

const T = Trade.enum;

/** Each trade's drivers schema, for code that holds the trade as a value. */
export const DRIVERS_SCHEMA = {
  [T.electrician]: ElectricianDrivers,
  [T.plumber]: PlumberDrivers,
  [T.maid]: MaidDrivers,
  [T.carpenter]: CarpenterDrivers,
  [T.ac_technician]: AcDrivers,
  [T.painter]: PainterDrivers,
  [T.cook]: CookDrivers,
  [T.driver]: ChauffeurDrivers,
} as const satisfies { [K in Trade]: z.ZodType<TradeDrivers[K]> };

/** Any trade's driver values, loosely: what generic code (ranking, keys) reads. */
export type DriverValues = Partial<Record<DriverName, string | number>>;

const N = DriverName.enum;

/** The drivers of a trade, in the order a household is asked about them when they widen the range equally. */
export const TRADE_DRIVERS: Readonly<Record<Trade, readonly DriverName[]>> = {
  [T.painter]: [N.area_sqft, N.surface, N.paint_by, N.floors, N.house_type, N.finish, N.rooms],
  [T.cook]: [N.meals, N.people, N.days_week],
  [T.maid]: [N.rooms, N.frequency, N.tasks],
  [T.driver]: [N.hours, N.days_week, N.vehicle],
  [T.electrician]: [N.problem, N.points],
  [T.plumber]: [N.problem, N.points],
  [T.carpenter]: [N.problem, N.points],
  [T.ac_technician]: [N.problem, N.points],
};

/**
 * How sure a range is (ADR 0041 §3): high only from many GigSync jobs with every driver known; low when the rates are
 * thin or the drivers that move the price most were assumed.
 */
export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;
