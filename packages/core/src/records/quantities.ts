import { areaBand, DriverName, type DriverValues, JobQuantities, quantitiesFit, type Trade } from "@gigsync/protocol";
import { detailsToDrivers } from "../estimate/driver-details.js";

/**
 * A signed job's quantities for its record (ADR 0041 §4): the price drivers both phones hold alike in the request's
 * details, as counts and fixed choices, the floor area as a band. Drivers the scope already keeps (meals, who buys the
 * paint, how often, the problem) are left to it. Never words: the strict schema refuses anything else.
 */

const D = DriverName.enum;
/** Drivers a record keeps in its scope columns instead. */
const IN_SCOPE: readonly DriverName[] = [D.meals, D.paint_by, D.frequency, D.problem];

export function jobQuantities(trade: Trade, details: Readonly<Record<string, string>>): JobQuantities | undefined {
  const drivers: DriverValues = detailsToDrivers(trade, details);
  const { area_sqft, ...rest } = drivers;
  const kept = Object.fromEntries(Object.entries(rest).filter(([name]) => !IN_SCOPE.includes(name as DriverName)));
  const raw = typeof area_sqft === "number" ? { ...kept, area_band: areaBand(area_sqft) } : kept;
  if (Object.keys(raw).length === 0) return undefined;
  const parsed = JobQuantities.safeParse(raw);
  return parsed.success && quantitiesFit(trade, parsed.data) ? parsed.data : undefined;
}
