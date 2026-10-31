import { z } from "zod";
import {
  AreaBand,
  ChauffeurDrivers,
  CookDrivers,
  DriverName,
  MaidDrivers,
  PainterDrivers,
  TRADE_DRIVERS,
} from "./estimate-drivers.js";
import type { Trade } from "./trade.js";

/**
 * A job record's quantities (ADR 0041 §4): the price drivers a record needs so GigSync can learn its own per-unit rates
 * (price per sq ft, per meal, per hour), as counts and fixed choices, never words. The floor area is kept as a band,
 * not the figure the household gave. Drivers the record's scope already holds (meals, who buys the paint, how often a
 * maid comes, the problem) are not repeated here.
 */
export const JobQuantities = z.strictObject({
  area_band: AreaBand.optional(),
  rooms: PainterDrivers.shape.rooms,
  surface: PainterDrivers.shape.surface,
  floors: PainterDrivers.shape.floors,
  house_type: PainterDrivers.shape.house_type,
  finish: PainterDrivers.shape.finish,
  people: CookDrivers.shape.people,
  days_week: CookDrivers.shape.days_week,
  tasks: MaidDrivers.shape.tasks,
  hours: ChauffeurDrivers.shape.hours,
  vehicle: ChauffeurDrivers.shape.vehicle,
  points: z.number().int().min(1).max(30).optional(),
});
export type JobQuantities = z.infer<typeof JobQuantities>;
export type JobQuantityKey = keyof JobQuantities;

/** The driver a quantity stands for: the area band for the area, the rest by their own name. */
const AREA_BAND = JobQuantities.keyof().enum.area_band;
const driverOf = (key: string): string => (key === AREA_BAND ? DriverName.enum.area_sqft : key);

/** Every quantity is one of the trade's drivers: a cook's record carries no floors. */
export const quantitiesFit = (trade: Trade, q: JobQuantities | undefined): boolean =>
  q === undefined ||
  Object.entries(q).every(
    ([key, value]) => value === undefined || (TRADE_DRIVERS[trade] as readonly string[]).includes(driverOf(key)),
  );
