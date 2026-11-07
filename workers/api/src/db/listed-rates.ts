import { type ListedRates, type ListedRatesQuery, MIN_LISTED_RATES } from "@gigsync/protocol";
import type { Db } from "./client.js";

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = 111;
/** Ranges are shown to ₹50: enough to set a budget by, too coarse to pick out one worker's rate. */
const ROUND_PAISE = 5000;

interface RatesRow {
  workers: number;
  low: number | null;
  high: number | null;
}

const rounded = (paise: number) => Math.max(ROUND_PAISE, Math.round(paise / ROUND_PAISE) * ROUND_PAISE);

/**
 * The middle half of the usual rates active workers near a place list for a skill or a kind of work; only the count
 * under the minimum. One worker counts once, however many wordings of the work they list.
 */
export async function listedRates(db: Db, q: ListedRatesQuery): Promise<ListedRates> {
  const { rows } = await db.query<RatesRow>(
    `SELECT count(*)::int AS workers,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY p.rate_paise) AS low,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY p.rate_paise) AS high
     FROM (SELECT DISTINCT user_id FROM worker_skills WHERE ${q.category ? "category" : "skill_key"} = $1) s
     JOIN worker_profiles p ON p.user_id = s.user_id
     JOIN users u ON u.user_id = p.user_id AND u.status = 'active'
     WHERE p.area_lat BETWEEN $2 - $4 / $6::float8 AND $2 + $4 / $6::float8
       AND 2 * $5::float8 * asin(sqrt(
         power(sin(radians(p.area_lat - $2) / 2), 2)
         + cos(radians($2)) * cos(radians(p.area_lat)) * power(sin(radians(p.area_lon - $3) / 2), 2))) <= $4`,
    [q.category ?? q.skill, q.lat, q.lon, q.radius_km, EARTH_RADIUS_KM, KM_PER_DEGREE],
  );
  const { workers = 0, low = null, high = null } = rows[0] ?? {};
  if (workers < MIN_LISTED_RATES || low === null || high === null) return { workers };
  return { workers, low_paise: rounded(low), high_paise: rounded(high) };
}
