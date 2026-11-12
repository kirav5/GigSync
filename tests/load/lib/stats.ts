/** Percentiles and summaries over one step's samples. */

/** The value at quantile `q` (0..1) of `values`, by the nearest-rank method; undefined when there are none. */
function quantile(values: readonly number[], q: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[rank];
}

export interface Spread {
  n: number;
  p50?: number;
  p90?: number;
  p99?: number;
  max?: number;
  mean?: number;
}

const P50 = 0.5;
const P90 = 0.9;
const P99 = 0.99;

const defined = <T>(o: Record<string, T | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Record<string, T>;

/** n, p50, p90, p99, max and mean of `values`, rounded to whole units. */
export function spread(values: readonly number[]): Spread {
  const round = (v: number | undefined) => (v === undefined ? undefined : Math.round(v));
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  return {
    n: values.length,
    ...defined({
      p50: round(quantile(values, P50)),
      p90: round(quantile(values, P90)),
      p99: round(quantile(values, P99)),
      max: round(values.length ? Math.max(...values) : undefined),
      mean: round(mean),
    }),
  };
}

/** The share of `values` above `limit`, as a percentage with one decimal. */
export function shareOver(values: readonly number[], limit: number): number {
  if (values.length === 0) return 0;
  return Math.round((1000 * values.filter((v) => v > limit).length) / values.length) / 10;
}

/** A plain-text table for the terminal: one row per object, columns in the order given. */
export function table(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  const cell = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => cell(r[c]).length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padStart(widths[i] ?? 0)).join("  ");
  return [line([...columns]), ...rows.map((r) => line(columns.map((c) => cell(r[c]))))].join("\n");
}
