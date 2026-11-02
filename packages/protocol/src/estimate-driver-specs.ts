import { DriverLimit, type DriverName, Finish, HouseType, MaidTasks, Surface, Vehicle } from "./estimate-drivers.js";
import { AcProblem, CarpenterProblem, ElectricianProblem, MaidFrequency, PlumberProblem } from "./estimate-scope.js";
import { MaterialsBy } from "./terms.js";
import { Trade } from "./trade.js";

/**
 * What each driver is (ADR 0041 §1): a quantity (it multiplies the per-unit rate: area, meals, hours, points) or an
 * adjustment (it scales it: outside walls, floors, finish, the car), its values or numeric range and unit, the value
 * assumed when it is unknown, and the spread assumed then: the values the estimate ranges over. Every default and
 * spread is an assumption, stated next to it, to be replaced by GigSync's own figures as job records carry quantities.
 */

export const DriverRole = { quantity: "quantity", adjustment: "adjustment" } as const;
export type DriverRole = (typeof DriverRole)[keyof typeof DriverRole];

export const DriverKind = { count: "count", choice: "choice" } as const;
export type DriverKind = (typeof DriverKind)[keyof typeof DriverKind];

/** The unit a count is in, for a phone to say it ("3,000 sq ft", "2 floors"). */
export const DriverUnit = {
  sqft: "sqft",
  floor: "floor",
  person: "person",
  meal: "meal",
  day: "day",
  room: "room",
  hour: "hour",
  point: "point",
} as const;
export type DriverUnit = (typeof DriverUnit)[keyof typeof DriverUnit];

/** A count driver: whole numbers from `min` to `max`; unknown, it ranges over `unknown` [low, high]. */
export interface CountSpec {
  kind: typeof DriverKind.count;
  role: DriverRole;
  unit: DriverUnit;
  min: number;
  max: number;
  default: number;
  unknown: readonly [number, number];
}

/** A choice driver: one of `values`; unknown, it ranges over the `unknown` values. */
export interface ChoiceSpec {
  kind: typeof DriverKind.choice;
  role: DriverRole;
  values: readonly string[];
  default: string;
  unknown: readonly string[];
}

export type DriverSpec = CountSpec | ChoiceSpec;

const Q = DriverRole.quantity;
const A = DriverRole.adjustment;
const U = DriverUnit;

const counted = (
  role: DriverRole,
  unit: DriverUnit,
  limit: { min: number; max: number },
  dflt: number,
  unknown: readonly [number, number],
): CountSpec => ({ kind: DriverKind.count, role, unit, ...limit, default: dflt, unknown });

const chosen = (role: DriverRole, values: readonly string[], dflt: string, unknown = values): ChoiceSpec => ({
  kind: DriverKind.choice,
  role,
  values,
  default: dflt,
  unknown,
});

const L = DriverLimit;
/** The days a week a maid's weekly rate is for: the rate card's weekly figure is three visits a week. */
export const MAID_WEEK_DAYS = 3;

/**
 * Repairs: the problem is unknown across all its kinds; points default to one and, unknown, to one to three (assumed:
 * most household repair calls are for one to three switches, taps or doors).
 */
const repairSpecs = (problems: readonly string[], other: string) => ({
  problem: chosen(A, problems, other),
  points: counted(Q, U.point, L.points, 1, [1, 3]),
});

const T = Trade.enum;

/** Each trade's drivers and what is assumed when one is unknown. */
export const DRIVER_SPECS: Readonly<Record<Trade, Readonly<Partial<Record<DriverName, DriverSpec>>>>> = {
  [T.painter]: {
    // Floor area. Unknown, it comes from bedrooms and house type (core's `estimatedArea`); this default is a 2BHK flat
    // and the spread a 1BHK flat to a 3BHK independent house (assumed, Bengaluru carpet areas).
    area_sqft: counted(Q, U.sqft, L.area_sqft, 1000, [600, 1800]),
    rooms: counted(Q, U.room, L.rooms, 2, [1, 4]),
    // Most repaint jobs are inside only; unknown ranges from inside only to inside and outside.
    surface: chosen(A, Surface.options, Surface.enum.inside, [Surface.enum.inside, Surface.enum.both]),
    floors: counted(A, U.floor, L.floors, 1, [1, 3]),
    house_type: chosen(A, HouseType.options, HouseType.enum.flat),
    // A painter usually brings the paint; unknown, labour only to paint included.
    paint_by: chosen(A, MaterialsBy.options, MaterialsBy.enum.worker),
    finish: chosen(A, Finish.options, Finish.enum.plain),
  },
  [T.cook]: {
    people: counted(A, U.person, L.people, 3, [2, 5]),
    meals: counted(Q, U.meal, L.meals, 2, [1, 3]),
    // Six days a week is the usual arrangement (26 working days a month, as the legal minimum counts).
    days_week: counted(Q, U.day, L.days_week, 6, [6, 7]),
  },
  [T.maid]: {
    rooms: counted(A, U.room, L.rooms, 2, [1, 4]),
    frequency: chosen(Q, MaidFrequency.options, MaidFrequency.enum.daily, [
      MaidFrequency.enum.alternate_days,
      MaidFrequency.enum.daily,
    ]),
    tasks: chosen(A, MaidTasks.options, MaidTasks.enum.sweep_mop_dishes),
    // Weekly work only (ADR 0046). ASSUMED: three days a week is the usual part-week arrangement, two to four unknown.
    days_week: counted(Q, U.day, L.days_week, MAID_WEEK_DAYS, [2, 4]),
  },
  [T.driver]: {
    hours: counted(Q, U.hour, L.hours, 8, [6, 10]),
    days_week: counted(Q, U.day, L.days_week, 6, [5, 7]),
    vehicle: chosen(A, Vehicle.options, Vehicle.enum.hatchback),
  },
  [T.electrician]: repairSpecs(ElectricianProblem.options, ElectricianProblem.enum.other),
  [T.plumber]: repairSpecs(PlumberProblem.options, PlumberProblem.enum.other),
  [T.carpenter]: repairSpecs(CarpenterProblem.options, CarpenterProblem.enum.other),
  [T.ac_technician]: repairSpecs(AcProblem.options, AcProblem.enum.other),
};

/** One trade's spec for a driver, when the trade has that driver. */
export const driverSpec = (trade: Trade, name: DriverName): DriverSpec | undefined => DRIVER_SPECS[trade][name];
