import type { BoardProfile, BoardQuery, BoardWorker, Trade, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** Areas are stored to two decimal places of a degree: about 1.1 km, a neighbourhood rather than a building. */
const AREA_SCALE = 100;
const EARTH_RADIUS_KM = 6371;
/** Kilometres per degree of latitude, for the cheap band that narrows a search before exact distances. */
const KM_PER_DEGREE = 111;
/** Distances are shown to a tenth of a kilometre: enough to compare, too coarse to locate anyone. */
const DISTANCE_SCALE = 10;

export const roundArea = (degrees: number) => Math.round(degrees * AREA_SCALE) / AREA_SCALE;

/** Publishes or replaces a worker's card, trades and languages together. Call inside a transaction. */
export async function upsertProfile(db: Db, user: UserId, p: BoardProfile, at: Date): Promise<void> {
  await db.query(
    `INSERT INTO worker_profiles (user_id, display_name, area_lat, area_lon, area_name, rate_paise, about, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET display_name = excluded.display_name, area_lat = excluded.area_lat,
       area_lon = excluded.area_lon, area_name = excluded.area_name, rate_paise = excluded.rate_paise,
       about = excluded.about, updated_at = excluded.updated_at`,
    [user, p.display_name, roundArea(p.area.lat), roundArea(p.area.lon), p.area_name, p.rate_paise, p.about, at],
  );
  await db.query("DELETE FROM worker_trades WHERE user_id = $1", [user]);
  await db.query("INSERT INTO worker_trades (user_id, trade) SELECT $1, unnest($2::text[])", [user, p.trades]);
  await db.query("DELETE FROM worker_languages WHERE user_id = $1", [user]);
  await db.query("INSERT INTO worker_languages (user_id, language) SELECT $1, unnest($2::text[])", [user, p.languages]);
}

/** Takes a worker off the board. True when there was a card to remove; trades and languages go with it. */
export async function removeProfile(db: Db, user: UserId): Promise<boolean> {
  const { rowCount } = await db.query("DELETE FROM worker_profiles WHERE user_id = $1", [user]);
  return (rowCount ?? 0) > 0;
}

interface BoardRow {
  user_id: UserId;
  display_name: string;
  area_lat: number;
  area_lon: number;
  area_name: string;
  rate_paise: number;
  about: string;
  trades: Trade[];
  languages: string[];
  distance_km: number;
}

/**
 * Active workers of one trade within the radius, nearest first, then cheapest. Distance is the haversine formula in
 * SQL; a latitude band (served by an index) keeps it from running over every worker of the trade.
 */
export async function searchWorkers(db: Db, q: BoardQuery): Promise<BoardWorker[]> {
  const { rows } = await db.query<BoardRow>(
    `SELECT p.user_id, p.display_name, p.area_lat, p.area_lon, p.area_name, p.rate_paise, p.about,
       ARRAY(SELECT t.trade FROM worker_trades t WHERE t.user_id = p.user_id ORDER BY t.trade) AS trades,
       ARRAY(SELECT l.language FROM worker_languages l WHERE l.user_id = p.user_id ORDER BY l.language) AS languages,
       d.km AS distance_km
     FROM worker_trades wt
     JOIN worker_profiles p ON p.user_id = wt.user_id
     JOIN users u ON u.user_id = p.user_id AND u.status = 'active'
     CROSS JOIN LATERAL (SELECT 2 * $7::float8 * asin(sqrt(
       power(sin(radians(p.area_lat - $2) / 2), 2)
       + cos(radians($2)) * cos(radians(p.area_lat)) * power(sin(radians(p.area_lon - $3) / 2), 2))) AS km) d
     WHERE wt.trade = $1
       AND p.area_lat BETWEEN $2 - $4 / $8::float8 AND $2 + $4 / $8::float8
       AND d.km <= $4
       AND ($5::int IS NULL OR p.rate_paise <= $5)
     ORDER BY d.km, p.rate_paise, p.user_id
     LIMIT $6`,
    [q.trade, q.lat, q.lon, q.radius_km, q.max_rate_paise ?? null, q.limit, EARTH_RADIUS_KM, KM_PER_DEGREE],
  );
  return rows.map((r) => ({
    user: r.user_id,
    display_name: r.display_name,
    trades: r.trades,
    area: { lat: r.area_lat, lon: r.area_lon },
    area_name: r.area_name,
    rate_paise: r.rate_paise,
    languages: r.languages,
    about: r.about,
    distance_km: Math.round(r.distance_km * DISTANCE_SCALE) / DISTANCE_SCALE,
  }));
}
