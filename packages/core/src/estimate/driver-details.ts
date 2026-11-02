import {
  allDrivers,
  DetailFlag,
  DRIVERS_SCHEMA,
  DriverKind,
  DriverName,
  type DriverValues,
  driverSpec,
  MaterialsBy,
  QuestionKey,
  type Trade,
  type TradeDrivers,
} from "@gigsync/protocol";
import { countIn } from "../job/details.js";

/**
 * A job's drivers (ADR 0041) and its details (the keyed answers a request carries to workers) are one set of facts in
 * two shapes: each driver is a detail under its own name, except who buys the paint, which details have always held as
 * `labour_only` ("yes" when the household buys it). Counts in details may carry words ("4 bhk"); a driver's count is
 * the first number in them, kept only inside the driver's limits.
 */

const D = DriverName.enum;
const Q = QuestionKey.enum;

/** The detail key each driver is kept under. */
const DETAIL_KEY: Readonly<Record<DriverName, QuestionKey>> = {
  [D.area_sqft]: Q.area_sqft,
  [D.rooms]: Q.rooms,
  [D.surface]: Q.surface,
  [D.floors]: Q.floors,
  [D.house_type]: Q.house_type,
  [D.paint_by]: Q.labour_only,
  [D.finish]: Q.finish,
  [D.people]: Q.people,
  [D.meals]: Q.meals,
  [D.days_week]: Q.days_week,
  [D.frequency]: Q.frequency,
  [D.tasks]: Q.tasks,
  [D.hours]: Q.hours,
  [D.vehicle]: Q.vehicle,
  [D.problem]: Q.problem,
  [D.points]: Q.points,
};
export const detailKeyOf = (name: DriverName): QuestionKey => DETAIL_KEY[name];

/** One detail as a driver's value, when it reads as one of the driver's values. */
function driverValueOf(trade: Trade, name: DriverName, detail: string | undefined): string | number | undefined {
  const spec = driverSpec(trade, name);
  if (!spec || detail === undefined) return undefined;
  if (name === D.paint_by) {
    if (detail === DetailFlag.enum.yes) return MaterialsBy.enum.household;
    return detail === DetailFlag.enum.no ? MaterialsBy.enum.worker : undefined;
  }
  if (spec.kind === DriverKind.choice) return spec.values.find((v) => v === detail);
  const n = countIn(detail);
  return n !== undefined && n >= spec.min && n <= spec.max ? n : undefined;
}

/** The drivers a job's details give, for its trade. */
export function detailsToDrivers(trade: Trade, details: Readonly<Record<string, string | undefined>>): DriverValues {
  const out: DriverValues = {};
  for (const name of allDrivers(trade)) {
    const value = driverValueOf(trade, name, details[detailKeyOf(name)]);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** The drivers as details: what joins the request's details, so the worker's agent need not ask them again. */
export function driversToDetails(trade: Trade, drivers: DriverValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of allDrivers(trade)) {
    const value = drivers[name];
    if (value === undefined) continue;
    if (name === D.paint_by)
      out[Q.labour_only] = value === MaterialsBy.enum.household ? DetailFlag.enum.yes : DetailFlag.enum.no;
    else out[DETAIL_KEY[name]] = String(value);
  }
  return out;
}

/** The drivers checked by the trade's schema, for a request; undefined when a value is out of bounds (a bug). */
export function tradeDrivers<K extends Trade>(trade: K, drivers: DriverValues): TradeDrivers[K] | undefined {
  const parsed = DRIVERS_SCHEMA[trade].safeParse(drivers);
  return parsed.success ? (parsed.data as TradeDrivers[K]) : undefined;
}
