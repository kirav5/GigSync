import type { City, EstimateSource, NoEstimateReason, Trade, UserId } from "@gigsync/protocol";
import type { WebBand } from "../estimates/compute.js";
import type { Db } from "./client.js";

/** One job type's cache row: a city, a trade and its scope buckets as one string. */
export interface CacheKey {
  city: City;
  trade: Trade;
  bucket: string;
}

/** A finished reading of the web for one job type: the band, or why there is none, and when it was read. */
export interface Reading {
  result: WebBand | NoEstimateReason;
  readAt: Date;
}

interface ReadingRow {
  low_paise: number | null;
  typical_paise: number | null;
  high_paise: number | null;
  quote_count: number | null;
  quotes: EstimateSource[];
  none_reason: NoEstimateReason | null;
  read_at: Date;
}

function toReading(r: ReadingRow): Reading | undefined {
  if (r.low_paise !== null && r.typical_paise !== null && r.high_paise !== null && r.quote_count !== null) {
    const band = { low: r.low_paise, typical: r.typical_paise, high: r.high_paise };
    return { result: { band, count: r.quote_count, sources: r.quotes }, readAt: r.read_at };
  }
  return r.none_reason === null ? undefined : { result: r.none_reason, readAt: r.read_at };
}

/** The last finished reading for a job type, however old; the caller decides whether it is fresh. */
export async function lastReading(db: Db, key: CacheKey): Promise<Reading | undefined> {
  const { rows } = await db.query<ReadingRow>(
    `SELECT low_paise, typical_paise, high_paise, quote_count, quotes, none_reason, read_at
     FROM estimate_cache WHERE city = $1 AND trade = $2 AND bucket = $3 AND read_at IS NOT NULL`,
    [key.city, key.trade, key.bucket],
  );
  return rows[0] && toReading(rows[0]);
}

/**
 * Claims the right to read the web for a job type: true for exactly one caller until it stores its reading, or until
 * its claim is older than `staleBefore` (a reading that died). One statement, so two requests cannot both win.
 */
export async function claimReading(db: Db, key: CacheKey, now: Date, staleBefore: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO estimate_cache (city, trade, bucket, computing_since) VALUES ($1, $2, $3, $4)
     ON CONFLICT (city, trade, bucket) DO UPDATE SET computing_since = excluded.computing_since
     WHERE estimate_cache.computing_since IS NULL OR estimate_cache.computing_since < $5`,
    [key.city, key.trade, key.bucket, now, staleBefore],
  );
  return (rowCount ?? 0) > 0;
}

/** Stores a finished reading and releases the claim. */
export async function storeReading(db: Db, key: CacheKey, reading: Reading): Promise<void> {
  const web = typeof reading.result === "string" ? undefined : reading.result;
  const round = (n: number | undefined) => (n === undefined ? null : Math.round(n));
  await db.query(
    `UPDATE estimate_cache SET low_paise = $4, typical_paise = $5, high_paise = $6, quote_count = $7, quotes = $8,
       none_reason = $9, read_at = $10, computing_since = NULL
     WHERE city = $1 AND trade = $2 AND bucket = $3`,
    [
      key.city,
      key.trade,
      key.bucket,
      round(web?.band.low),
      round(web?.band.typical),
      round(web?.band.high),
      web?.count ?? null,
      JSON.stringify(web?.sources ?? []),
      web ? null : reading.result,
      reading.readAt,
    ],
  );
}

/** Shared prices for a job type agreed in or after `since` (a month), newest months first, at most `limit`. */
export async function sharedPrices(db: Db, key: CacheKey, since: string, limit: number): Promise<number[]> {
  const { rows } = await db.query<{ price_paise: number }>(
    `SELECT price_paise FROM shared_prices WHERE city = $1 AND trade = $2 AND bucket = $3 AND month >= $4
     ORDER BY month DESC LIMIT $5`,
    [key.city, key.trade, key.bucket, since, limit],
  );
  return rows.map((r) => r.price_paise);
}

/**
 * Counts one share for a user today, unless they reached `max`: true when counted. Their earlier days go first, so
 * the table keeps at most one row per user. Call inside the same transaction as the insert.
 */
export async function countShare(db: Db, user: UserId, day: string, max: number): Promise<boolean> {
  await db.query("DELETE FROM price_share_counts WHERE user_id = $1 AND day < $2", [user, day]);
  const { rowCount } = await db.query(
    `INSERT INTO price_share_counts (user_id, day, shares) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET shares = price_share_counts.shares + 1
     WHERE price_share_counts.shares < $3`,
    [user, day, max],
  );
  return (rowCount ?? 0) > 0;
}

/** Stores one shared price. No user id goes in. */
export async function insertSharedPrice(
  db: Db,
  key: CacheKey,
  price: { area_key: string; price_paise: number; month: string },
): Promise<void> {
  await db.query(
    `INSERT INTO shared_prices (city, trade, bucket, area_key, price_paise, month) VALUES ($1, $2, $3, $4, $5, $6)`,
    [key.city, key.trade, key.bucket, price.area_key, price.price_paise, price.month],
  );
}
