import { IQR_FACTOR, Percentile } from "./constants.js";

/**
 * The p-th percentile (0–1) of sorted values, by linear interpolation between the closest ranks (the common "type 7"
 * definition, as spreadsheets compute it). Undefined for no values.
 */
export function percentile(sorted: readonly number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const rank = p * (sorted.length - 1);
  const below = Math.floor(rank);
  const lower = sorted[below] as number;
  const upper = sorted[Math.min(below + 1, sorted.length - 1)] as number;
  return lower + (upper - lower) * (rank - below);
}

const ascending = (a: number, b: number) => a - b;

/** Values inside Tukey's fences (1.5 × IQR beyond the quartiles), with the item each came from, sorted ascending. */
export function withoutOutliers<T>(items: readonly T[], value: (item: T) => number): T[] {
  const sorted = [...items].sort((a, b) => value(a) - value(b));
  const values = sorted.map(value);
  const q1 = percentile(values, Percentile.low);
  const q3 = percentile(values, Percentile.high);
  if (q1 === undefined || q3 === undefined) return [];
  const spread = (q3 - q1) * IQR_FACTOR;
  return sorted.filter((item) => value(item) >= q1 - spread && value(item) <= q3 + spread);
}

/** The low, typical and high figures of a set of values: 25th, 50th and 75th percentiles. */
export interface Band {
  low: number;
  typical: number;
  high: number;
}

export function bandOf(values: readonly number[]): Band | undefined {
  const sorted = [...values].sort(ascending);
  const low = percentile(sorted, Percentile.low);
  const typical = percentile(sorted, Percentile.typical);
  const high = percentile(sorted, Percentile.high);
  if (low === undefined || typical === undefined || high === undefined) return undefined;
  return { low, typical, high };
}

/** Rounds to the nearest step, never to zero: a price is always at least one step. */
export const roundTo = (value: number, step: number): number => Math.max(step, Math.round(value / step) * step);
/** Rounds up to the step: for a legal floor, which must never be shown lower than it is. */
export const roundUpTo = (value: number, step: number): number => Math.ceil(value / step) * step;
