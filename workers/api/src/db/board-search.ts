import {
  type BoardQuery,
  type BoardWorker,
  DEFAULT_ARRANGEMENT,
  DEFAULT_JOB_HOURS,
  EVERY_DAY,
  isoWeekday,
  type UserId,
} from "@gigsync/protocol";
import { CARD_COLUMNS, type CardRow, cardOf } from "./board.js";
import type { Db } from "./client.js";

const EARTH_RADIUS_KM = 6371;
/** Kilometres per degree of latitude, for the cheap band that narrows a search before exact distances. */
const KM_PER_DEGREE = 111;
/** Distances are shown to a tenth of a kilometre: enough to compare, too coarse to locate anyone. */
const DISTANCE_SCALE = 10;

interface BoardRow extends CardRow {
  user_id: UserId;
  distance_km: number;
}

/** Where a search starts: the workers of one trade, or the workers who list one skill (ADR 0047), as `w`. */
const BY_TRADE = "SELECT user_id FROM worker_trades WHERE trade = $1";
const BY_SKILL = "SELECT user_id FROM worker_skills WHERE skill_key = $1";

/**
 * The search over the workers in `from`. $11 date, $12 its weekday, $13 window, $14 every day, $15 hour, $16 the
 * length of a job without hours of its own.
 *
 * A worker's own hours: with an asked hour and the card's from–to (ADR 0053 §1), the hour must fall in them; otherwise
 * the card's parts of the day decide, as before (ADR 0050). A signed job hides the worker on its day (or every day)
 * when it clashes: by overlap of the two jobs' hours when both start hours are known (the asked job is taken to last
 * DEFAULT_JOB_HOURS), otherwise by the same part of the day. Hours stay within one day: nothing wraps past midnight.
 */
const searchSql = (from: string) => `SELECT p.user_id, ${CARD_COLUMNS}, d.km AS distance_km
  FROM (${from}) w
  JOIN worker_profiles p ON p.user_id = w.user_id
  JOIN users u ON u.user_id = p.user_id AND u.status = 'active'
  CROSS JOIN LATERAL (SELECT 2 * $7::float8 * asin(sqrt(
    power(sin(radians(p.area_lat - $2) / 2), 2)
    + cos(radians($2)) * cos(radians(p.area_lat)) * power(sin(radians(p.area_lon - $3) / 2), 2))) AS km) d
  WHERE p.area_lat BETWEEN $2 - $4 / $8::float8 AND $2 + $4 / $8::float8
    AND d.km <= $4
    AND ($5::int IS NULL OR p.rate_paise <= $5)
    AND ($9::text IS NULL OR EXISTS (
      SELECT 1 FROM worker_arrangements a WHERE a.user_id = p.user_id AND a.arrangement = $9)
      OR ($9::text = $10::text AND NOT EXISTS (SELECT 1 FROM worker_arrangements a WHERE a.user_id = p.user_id)))
    AND ($12::smallint IS NULL OR p.work_days IS NULL OR $12::smallint = ANY (p.work_days))
    AND CASE WHEN $15::int IS NOT NULL AND p.work_from IS NOT NULL
      THEN $15::int >= p.work_from AND $15::int < p.work_to
      ELSE $13::text IS NULL OR p.work_windows IS NULL OR $13::text = ANY (p.work_windows) END
    AND NOT (($13::text IS NOT NULL OR $15::int IS NOT NULL) AND ($11::date IS NOT NULL OR $14::boolean) AND EXISTS (
      SELECT 1 FROM job_records j WHERE j.worker_id = p.user_id AND j.status = 'agreed'
        AND (j.work_daily OR j.work_day = $11::date)
        AND CASE WHEN $15::int IS NOT NULL AND j.work_hour IS NOT NULL
          THEN j.work_hour < $15::int + $16::int AND $15::int < j.work_hour + COALESCE(j.hours_per_day, $16::int)
          ELSE j.work_window = $13::text END))
  ORDER BY d.km, p.rate_paise, p.user_id
  LIMIT $6`;

/**
 * Active workers of one trade or skill within the radius, nearest first, then cheapest. Distance is the haversine
 * formula in SQL; a latitude band (served by an index) keeps it from running over every worker of the trade. With a
 * day, a part of the day or an hour: only workers whose hours include them, and none with a clashing signed job on
 * GigSync's record (see searchSql). Bookings on phones are not seen here.
 */
export async function searchWorkers(db: Db, q: BoardQuery): Promise<BoardWorker[]> {
  const date = q.day !== undefined && q.day !== EVERY_DAY ? q.day : null;
  const { rows } = await db.query<BoardRow>(searchSql(q.skill === undefined ? BY_TRADE : BY_SKILL), [
    q.skill ?? q.trade,
    q.lat,
    q.lon,
    q.radius_km,
    q.max_rate_paise ?? null,
    q.limit,
    EARTH_RADIUS_KM,
    KM_PER_DEGREE,
    q.arrangement ?? null,
    DEFAULT_ARRANGEMENT,
    date,
    date ? isoWeekday(date) : null,
    q.window ?? null,
    q.day === EVERY_DAY,
    q.hour ?? null,
    DEFAULT_JOB_HOURS,
  ]);
  return rows.map((r) => ({
    ...cardOf(r),
    user: r.user_id,
    distance_km: Math.round(r.distance_km * DISTANCE_SCALE) / DISTANCE_SCALE,
  }));
}
