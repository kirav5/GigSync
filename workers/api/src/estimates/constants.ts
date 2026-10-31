/** The estimate engine's limits and thresholds (ADR 0039, ADR 0041). Open there: K_MIN. */

/**
 * A range from GigSync's agreed prices counts only when its group (an area, or the city) holds at least this many jobs,
 * between at least this many workers and this many households: no one person's price can be read from it.
 */
export const K_MIN = 10;
/** Agreed prices from this many calendar months back, to now, count for GigSync's rates. */
export const MARKET_MONTHS = 12;

export const Percentile = { low: 0.25, typical: 0.5, high: 0.75 } as const;

/** Figures are rounded to ₹10. */
export const ROUND_PAISE = 1000;

/** Weeks in a month, for a once-a-week price per month. */
export const WEEKS_PER_MONTH = 52 / 12;
