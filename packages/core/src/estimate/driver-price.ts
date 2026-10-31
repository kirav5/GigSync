import {
  DriverName,
  type DriverValues,
  driverSpec,
  type HouseType,
  type MaidFrequency,
  type MaidTasks,
  type MaterialsBy,
  type Surface,
  TRADE_DRIVERS,
  Trade,
  type Vehicle,
} from "@gigsync/protocol";
import {
  AREA_FROM_ROOMS_SPREAD,
  BASE_DAYS_WEEK,
  COOK_BASE_PEOPLE,
  COOK_PER_PERSON,
  EXTRA_POINT,
  FINISH_FACTOR,
  HOUSE_FACTOR,
  MAID_BASE_ROOMS,
  MAID_FREQUENCY_FACTOR,
  MAID_PER_ROOM,
  MAID_TASKS_FACTOR,
  OUTSIDE_PER_FLOOR,
  PAINT_BY_FACTOR,
  type PaiseRange,
  PROBLEM_FACTOR,
  SQFT_PER_ROOM,
  SURFACE_FACTOR,
  VEHICLE_FACTOR,
} from "./driver-rates.js";

/**
 * The price maths of ADR 0041 §3, pure and shared by the phone and the server: a job's factor is its quantity times
 * its adjustments against the trade's base job, so a range is the per-unit rate times that factor. An unknown driver
 * ranges over its assumed spread (`DRIVER_SPECS`), which widens the range; the drivers that widen it most are the ones
 * worth asking about.
 */

const T = Trade.enum;
const D = DriverName.enum;

/** One value per driver, every driver of the trade filled: what `jobFactor` reads. */
type Filled = Readonly<Record<string, string | number>>;
/** How sure an estimated area is: a scale on the area from bedrooms, 1 when the area is known. */
const AREA_SCALE = "area_scale";
/** No adjustment cuts a job below this share of its base (one person, one room). */
const MIN_ADJUST = 0.5;

const num = (f: Filled, name: string): number => Number(f[name]);
const str = <S extends string>(f: Filled, name: string): S => String(f[name]) as S;
const atLeast = (n: number) => Math.max(MIN_ADJUST, n);

function painterFactor(f: Filled): number {
  const house = str<HouseType>(f, D.house_type);
  const area =
    f[D.area_sqft] !== undefined ? num(f, D.area_sqft) : num(f, D.rooms) * SQFT_PER_ROOM[house] * num(f, AREA_SCALE);
  const surface = SURFACE_FACTOR[str<Surface>(f, D.surface)];
  const outside = surface.outside * (1 + OUTSIDE_PER_FLOOR * (num(f, D.floors) - 1));
  return (
    area *
    (surface.inside + outside) *
    HOUSE_FACTOR[house] *
    PAINT_BY_FACTOR[str<MaterialsBy>(f, D.paint_by)] *
    FINISH_FACTOR[str<keyof typeof FINISH_FACTOR>(f, D.finish)]
  );
}

/** The job's factor against the trade's base job, every driver filled. */
export function jobFactor(trade: Trade, f: Filled): number {
  const week = num(f, D.days_week) / BASE_DAYS_WEEK;
  switch (trade) {
    case T.painter:
      return painterFactor(f);
    case T.cook:
      return num(f, D.meals) * week * atLeast(1 + COOK_PER_PERSON * (num(f, D.people) - COOK_BASE_PEOPLE));
    case T.maid:
      return (
        MAID_FREQUENCY_FACTOR[str<MaidFrequency>(f, D.frequency)] *
        MAID_TASKS_FACTOR[str<MaidTasks>(f, D.tasks)] *
        atLeast(1 + MAID_PER_ROOM * (num(f, D.rooms) - MAID_BASE_ROOMS))
      );
    case T.driver:
      return num(f, D.hours) * week * VEHICLE_FACTOR[str<Vehicle>(f, D.vehicle)];
    default:
      return (PROBLEM_FACTOR[trade]?.[str(f, D.problem)] ?? 1) * (1 + EXTRA_POINT * (num(f, D.points) - 1));
  }
}

/** One unknown dimension: a driver (or the area's own uncertainty) and the values assumed for it. */
interface Axis {
  name: DriverName;
  /** The keys this axis sets: usually its driver; for an unknown area, the area scale (and bedrooms if unknown). */
  values: readonly Readonly<Record<string, string | number>>[];
}

const typicalOf = (trade: Trade, name: DriverName): string | number | undefined => driverSpec(trade, name)?.default;

function assumedValues(trade: Trade, name: DriverName): (string | number)[] {
  return [...(driverSpec(trade, name)?.unknown ?? [])];
}

/**
 * The unknown axes and the typical filling. A painter's unknown area comes from bedrooms and house type, within
 * `AREA_FROM_ROOMS_SPREAD`; once the area is known, bedrooms no longer matter.
 */
function axesOf(trade: Trade, known: DriverValues): { axes: Axis[]; typical: Record<string, string | number> } {
  const typical: Record<string, string | number> = {};
  const axes: Axis[] = [];
  const areaKnown = trade === T.painter && known.area_sqft !== undefined;
  for (const name of TRADE_DRIVERS[trade]) {
    const value = known[name];
    if (value !== undefined) {
      typical[name] = value;
      continue;
    }
    if (name === D.area_sqft) {
      typical[AREA_SCALE] = 1;
      continue;
    }
    if (name === D.rooms && areaKnown) continue;
    const dflt = typicalOf(trade, name);
    if (dflt !== undefined) typical[name] = dflt;
    axes.push({ name, values: assumedValues(trade, name).map((v) => ({ [name]: v })) });
  }
  if (trade === T.painter && !areaKnown) axes.unshift(areaAxis(known, typical));
  return { axes, typical };
}

/** An unknown area: the scale either way, and bedrooms across their spread when they are unknown too. */
function areaAxis(known: DriverValues, typical: Record<string, string | number>): Axis {
  const scales = [1 - AREA_FROM_ROOMS_SPREAD, 1 + AREA_FROM_ROOMS_SPREAD];
  const rooms = known.rooms !== undefined ? [known.rooms] : assumedValues(T.painter, D.rooms);
  const values = scales.flatMap((s) => rooms.map((r) => ({ [AREA_SCALE]: s, [D.rooms]: r })));
  typical[AREA_SCALE] = 1;
  return { name: D.area_sqft, values };
}

/** Min and max of the factor over every combination of the axes' values, the rest typical. */
function extremes(trade: Trade, axes: readonly Axis[], typical: Filled): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  const walk = (at: number, filled: Filled) => {
    const axis = axes[at];
    if (!axis) {
      const factor = jobFactor(trade, filled);
      min = Math.min(min, factor);
      max = Math.max(max, factor);
      return;
    }
    for (const v of axis.values) walk(at + 1, { ...filled, ...v });
  };
  walk(0, typical);
  return { min, max };
}

/** How the unknown drivers spread a job's factor: its least, typical and most, and each unknown's own width. */
export interface DriverSpread {
  min: number;
  typical: number;
  max: number;
  /** The unknown drivers that move the price, widest first (max over min when only it varies). */
  assumed: DriverName[];
  widths: Partial<Record<DriverName, number>>;
}

/** Below this width an unknown driver does not move the price: not assumed, not asked. */
const NO_WIDTH = 1.001;
/**
 * The share of the unknowns' combined log span a range shows. A range is the usual middle (the 25th to 75th
 * percentile, as GigSync's own prices give it), not every possible job, so an unknown driver widens it by half its
 * span rather than to its extremes. An assumption, to be checked against agreed jobs as they come (ADR 0041).
 */
const UNKNOWN_SHARE = 0.5;

/**
 * Each unknown is measured alone, the others typical, and the unknowns are combined in quadrature on a log scale:
 * independent unknowns rarely all sit at the same end, so stacking every extreme (the product of the worst cases)
 * would give ranges too wide to help anyone. `UNKNOWN_SHARE` of that span is shown.
 */
export function driverSpread(trade: Trade, known: DriverValues): DriverSpread {
  const { axes, typical } = axesOf(trade, known);
  const mid = jobFactor(trade, typical);
  const widths: Partial<Record<DriverName, number>> = {};
  let down = 0;
  let up = 0;
  for (const axis of axes) {
    const one = extremes(trade, [axis], typical);
    widths[axis.name] = one.max / one.min;
    down += Math.log(mid / Math.min(one.min, mid)) ** 2;
    up += Math.log(Math.max(one.max, mid) / mid) ** 2;
  }
  const order = TRADE_DRIVERS[trade];
  const assumed = axes
    .map((a) => a.name)
    .filter((name) => (widths[name] ?? 1) > NO_WIDTH)
    .sort((a, b) => (widths[b] ?? 1) - (widths[a] ?? 1) || order.indexOf(a) - order.indexOf(b));
  const spread = (sum: number) => Math.exp(UNKNOWN_SHARE * Math.sqrt(sum));
  return { min: mid / spread(down), typical: mid, max: mid * spread(up), assumed, widths };
}

/** The factor with every unknown driver at its default: how a job record's price is turned into a per-unit rate. */
export const typicalFactor = (trade: Trade, known: DriverValues): number =>
  jobFactor(trade, axesOf(trade, known).typical);

/** The unknown drivers worth asking, widest first, leaving out any the owner already said they do not know. */
export const rankUnknown = (trade: Trade, known: DriverValues, notKnown: readonly DriverName[] = []): DriverName[] =>
  driverSpread(trade, known).assumed.filter((name) => !notKnown.includes(name));

/** A per-unit range as the job's range: low × least factor, typical × typical, high × most, in order. */
export function jobRange(rate: PaiseRange, spread: Pick<DriverSpread, "min" | "typical" | "max">): PaiseRange {
  const low = rate.low * spread.min;
  const high = rate.high * spread.max;
  const typical = Math.min(Math.max(rate.typical * spread.typical, low), high);
  return { low, typical, high };
}
