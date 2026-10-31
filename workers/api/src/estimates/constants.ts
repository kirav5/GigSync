/** The estimate service's names, limits and thresholds (ADR 0030, ADR 0039). Open there: K_MIN and ESTIMATE_TTL_MS. */

/** Values of ESTIMATE_SOURCE, and each quote source's name in the logs. */
export const SourceName = { anthropic: "anthropic", fixture: "fixture" } as const;

const DAY_MS = 24 * 60 * 60_000;

/** A job type is read from the web at most once per this long, per city and scope bucket. */
export const ESTIMATE_TTL_MS = 7 * DAY_MS;
/** A computation that has not finished in this long is taken as dead; the next request may start another. */
export const LOCK_TTL_MS = 10 * 60_000;

/** At least this many checked quotes, from at least this many sites, or there is no estimate. */
export const MIN_QUOTES = 3;
export const MIN_SITES = 2;
/**
 * A range from GigSync's agreed prices is shown only when at least this many jobs fall in the group (an area, or the
 * city): no one person's price can be read from it.
 */
export const K_MIN = 10;
/** Agreed prices from this many calendar months back, to now, count for a market range. */
export const MARKET_MONTHS = 12;

/** Tukey's fences: a value further than this many interquartile ranges outside the quartiles is an outlier. */
export const IQR_FACTOR = 1.5;
export const Percentile = { low: 0.25, typical: 0.5, high: 0.75 } as const;

/** Figures are rounded to ₹10; per-square-foot figures to ₹1, where ₹10 would swallow the price. */
export const ROUND_PAISE = 1000;
export const ROUND_SQFT_PAISE = 100;

/** A sentence shorter than this could match almost any page, so it proves nothing. */
export const MIN_SENTENCE_CHARS = 20;

/** Weeks in a month, for a once-a-week price per month. */
export const WEEKS_PER_MONTH = 52 / 12;
