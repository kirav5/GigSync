import { allDrivers } from "./arrangement.js";
import type { DriverValues } from "./estimate-drivers.js";
import {
  DEFAULT_SCOPE,
  type HoursBand,
  hoursBand,
  mealsBucket,
  type PeopleBand,
  peopleBand,
  type RoomsBucket,
  roomsBucket,
  type TradeScope,
} from "./estimate-scope.js";
import { DetailFlag } from "./lang.js";
import { MaterialsBy } from "./terms.js";
import { Trade } from "./trade.js";

/**
 * Between ADR 0030's scope buckets and ADR 0041's drivers, both ways, so cached estimates, job records and phones in
 * the field that know only buckets keep working: a bucket becomes the driver value it stands for (a band's typical
 * member), and drivers become the buckets an older reader expects, the trade's default where a driver is unknown.
 */

const T = Trade.enum;

/** The value a band stands for: its lower member for a closed band, the bound for an open one. */
const ROOMS: Readonly<Record<RoomsBucket, number>> = { bhk1: 1, bhk2: 2, bhk3: 3, bhk4_plus: 4 };
const PEOPLE: Readonly<Record<PeopleBand, number>> = { "1_2": 2, "3_4": 3, "5_plus": 5 };
const HOURS: Readonly<Record<HoursBand, number>> = { up_to_6: 6, "7_to_9": 8, "10_plus": 10 };

type AnyScope = Partial<Record<string, string>>;

const known = (o: Record<string, string | number | undefined>): DriverValues =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** A scope's buckets as drivers: what an old request or an old job record says about the job. */
export function driversFromScope(trade: Trade, scope: AnyScope): DriverValues {
  const rooms = scope.rooms === undefined ? undefined : ROOMS[scope.rooms as RoomsBucket];
  switch (trade) {
    case T.painter: {
      const labour = scope.labour_only;
      const paint_by =
        labour === undefined
          ? undefined
          : labour === DetailFlag.enum.yes
            ? MaterialsBy.enum.household
            : MaterialsBy.enum.worker;
      return known({ rooms, paint_by });
    }
    case T.maid:
      return known({ rooms, frequency: scope.frequency });
    case T.cook:
      return known({
        people: scope.people === undefined ? undefined : PEOPLE[scope.people as PeopleBand],
        meals: scope.meals === undefined ? undefined : Number(scope.meals),
      });
    case T.driver:
      return known({ hours: scope.hours === undefined ? undefined : HOURS[scope.hours as HoursBand] });
    default:
      return known({ problem: scope.problem });
  }
}

const numberOf = (v: string | number | undefined): number | undefined => (typeof v === "number" ? v : undefined);
const textOf = (v: string | number | undefined): string | undefined => (typeof v === "string" ? v : undefined);

/** Drivers as the trade's scope buckets, the default bucket where a driver is unknown. Checked by the caller's schema. */
export function scopeFromDrivers<K extends Trade>(trade: K, drivers: DriverValues): TradeScope[K] {
  const d = DEFAULT_SCOPE;
  const rooms = numberOf(drivers.rooms);
  const people = numberOf(drivers.people);
  const meals = numberOf(drivers.meals);
  const hours = numberOf(drivers.hours);
  const scopes: { [T in Trade]: TradeScope[T] } = {
    [T.painter]: {
      ...(rooms === undefined && drivers.area_sqft !== undefined
        ? {}
        : { rooms: rooms === undefined ? d.painter.rooms : roomsBucket(rooms) }),
      labour_only:
        drivers.paint_by === undefined
          ? d.painter.labour_only
          : drivers.paint_by === MaterialsBy.enum.household
            ? DetailFlag.enum.yes
            : DetailFlag.enum.no,
    },
    [T.maid]: {
      rooms: rooms === undefined ? d.maid.rooms : roomsBucket(rooms),
      frequency: (textOf(drivers.frequency) as TradeScope["maid"]["frequency"] | undefined) ?? d.maid.frequency,
    },
    [T.cook]: {
      people: people === undefined ? d.cook.people : peopleBand(people),
      meals: meals === undefined ? d.cook.meals : mealsBucket(meals),
    },
    [T.driver]: { hours: hours === undefined ? d.driver.hours : hoursBand(hours) },
    [T.electrician]: {
      problem: (textOf(drivers.problem) ?? d.electrician.problem) as TradeScope["electrician"]["problem"],
    },
    [T.plumber]: { problem: (textOf(drivers.problem) ?? d.plumber.problem) as TradeScope["plumber"]["problem"] },
    [T.carpenter]: { problem: (textOf(drivers.problem) ?? d.carpenter.problem) as TradeScope["carpenter"]["problem"] },
    [T.ac_technician]: {
      problem: (textOf(drivers.problem) ?? d.ac_technician.problem) as TradeScope["ac_technician"]["problem"],
    },
  };
  return scopes[trade];
}

/** Only the drivers the trade has: a value for another trade's driver is dropped. */
export function tradeDriversOnly(trade: Trade, drivers: DriverValues): DriverValues {
  return Object.fromEntries(allDrivers(trade).flatMap((n) => (drivers[n] === undefined ? [] : [[n, drivers[n]]])));
}
