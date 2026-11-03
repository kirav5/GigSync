import {
  type ArrangementRate,
  type BoardProfile,
  type BoardQuery,
  type BoardWorker,
  DEFAULT_ARRANGEMENT,
  EVERY_DAY,
  isoWeekday,
  type MyBoardProfile,
  type Skill,
  skillKey,
  type TimeWindow,
  type Trade,
  type UserId,
} from "@gigsync/protocol";
import { recordOf } from "../records/serve.js";
import type { Db } from "./client.js";
import { RECORD_COLUMNS, type RecordRow } from "./records.js";

/** Areas are stored to two decimal places of a degree: about 1.1 km, a neighbourhood rather than a building. */
const AREA_SCALE = 100;
const EARTH_RADIUS_KM = 6371;
/** Kilometres per degree of latitude, for the cheap band that narrows a search before exact distances. */
const KM_PER_DEGREE = 111;
/** Distances are shown to a tenth of a kilometre: enough to compare, too coarse to locate anyone. */
const DISTANCE_SCALE = 10;

export const roundArea = (degrees: number) => Math.round(degrees * AREA_SCALE) / AREA_SCALE;

/**
 * Publishes or replaces a worker's card, trades and languages together, and their Show my record switch (unchanged
 * when not sent; a new card shows it). A `record` sent with the card is ignored: the server computes it (ADR 0038).
 * Call inside a transaction.
 */
export async function upsertProfile(db: Db, user: UserId, p: BoardProfile, at: Date): Promise<void> {
  await db.query(
    `INSERT INTO worker_profiles (user_id, display_name, area_lat, area_lon, area_name, rate_paise, about, updated_at,
       show_record, work_days, work_windows)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE), $10, $11)
     ON CONFLICT (user_id) DO UPDATE SET display_name = excluded.display_name, area_lat = excluded.area_lat,
       area_lon = excluded.area_lon, area_name = excluded.area_name, rate_paise = excluded.rate_paise,
       about = excluded.about, updated_at = excluded.updated_at,
       show_record = COALESCE($9, worker_profiles.show_record),
       work_days = excluded.work_days, work_windows = excluded.work_windows`,
    [
      user,
      p.display_name,
      roundArea(p.area.lat),
      roundArea(p.area.lon),
      p.area_name,
      p.rate_paise,
      p.about,
      at,
      p.show_record ?? null,
      p.work_hours?.days ?? null,
      p.work_hours?.windows ?? null,
    ],
  );
  await db.query("DELETE FROM worker_trades WHERE user_id = $1", [user]);
  await db.query("INSERT INTO worker_trades (user_id, trade) SELECT $1, unnest($2::text[])", [user, p.trades]);
  await db.query("DELETE FROM worker_languages WHERE user_id = $1", [user]);
  await db.query("INSERT INTO worker_languages (user_id, language) SELECT $1, unnest($2::text[])", [user, p.languages]);
  const skills = p.skills ?? [];
  await db.query("DELETE FROM worker_skills WHERE user_id = $1", [user]);
  await db.query(
    "INSERT INTO worker_skills (user_id, skill_key, text, lang) SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[])",
    [user, skills.map((k) => skillKey(k.text)), skills.map((k) => k.text), skills.map((k) => k.lang)],
  );
  const arrangements = p.arrangements ?? [];
  await db.query("DELETE FROM worker_arrangements WHERE user_id = $1", [user]);
  await db.query(
    "INSERT INTO worker_arrangements (user_id, arrangement, rate_paise) SELECT $1, unnest($2::text[]), unnest($3::int[])",
    [user, arrangements.map((a) => a.arrangement), arrangements.map((a) => a.rate_paise)],
  );
}

/** Takes a worker off the board. True when there was a card to remove; trades and languages go with it. */
export async function removeProfile(db: Db, user: UserId): Promise<boolean> {
  const { rowCount } = await db.query("DELETE FROM worker_profiles WHERE user_id = $1", [user]);
  return (rowCount ?? 0) > 0;
}

/**
 * A worker's public card from `worker_profiles p`, with their trades and languages in a stable order and what their
 * record is served from.
 */
export const CARD_COLUMNS = `p.display_name, p.area_lat, p.area_lon, p.area_name, p.rate_paise, p.about,
  p.work_days, p.work_windows,
  ARRAY(SELECT t.trade FROM worker_trades t WHERE t.user_id = p.user_id ORDER BY t.trade) AS trades,
  ARRAY(SELECT json_build_object('text', s.text, 'lang', s.lang)
    FROM worker_skills s WHERE s.user_id = p.user_id ORDER BY s.skill_key) AS skills,
  ARRAY(SELECT l.language FROM worker_languages l WHERE l.user_id = p.user_id ORDER BY l.language) AS languages,
  ARRAY(SELECT json_build_object('arrangement', a.arrangement, 'rate_paise', a.rate_paise)
    FROM worker_arrangements a WHERE a.user_id = p.user_id ORDER BY a.arrangement) AS arrangements,
  ${RECORD_COLUMNS}`;

/** The columns CARD_COLUMNS selects. */
export interface CardRow extends RecordRow {
  display_name: string;
  area_lat: number;
  area_lon: number;
  area_name: string;
  rate_paise: number;
  about: string;
  /** ADR 0050: the worker's days and parts of the day; NULL when they work any day, any time. */
  work_days: number[] | null;
  work_windows: TimeWindow[] | null;
  trades: Trade[];
  /** ADR 0047: the worker's own skills; empty for a card that lists trades only. */
  skills: Skill[];
  languages: string[];
  /** Empty for a card that takes monthly work only. */
  arrangements: ArrangementRate[];
}

/** The card's own fields, without the record. */
const fieldsOf = (r: CardRow): BoardProfile => ({
  display_name: r.display_name,
  trades: r.trades,
  ...(r.skills.length > 0 ? { skills: r.skills } : {}),
  area: { lat: r.area_lat, lon: r.area_lon },
  area_name: r.area_name,
  rate_paise: r.rate_paise,
  languages: r.languages,
  about: r.about,
  ...(r.arrangements.length > 0 ? { arrangements: r.arrangements } : {}),
  ...(r.work_days && r.work_windows ? { work_hours: { days: r.work_days, windows: r.work_windows } } : {}),
});

/** The card as the board and a scanned QR show it: the server's record unless the worker hid it, never the switch. */
export function cardOf(r: CardRow): BoardProfile {
  const record = r.show_record ? recordOf(r) : undefined;
  return record ? { ...fieldsOf(r), record } : fieldsOf(r);
}

/** The card as its owner sees it: the switch, and the record even while hidden from others. */
function myCardOf(r: CardRow): MyBoardProfile {
  const record = recordOf(r);
  const card = { ...fieldsOf(r), show_record: r.show_record };
  return record ? { ...card, record } : card;
}

interface BoardRow extends CardRow {
  user_id: UserId;
  distance_km: number;
}

/** Where a search starts: the workers of one trade, or the workers who list one skill (ADR 0047), as `w`. */
const BY_TRADE = "SELECT user_id FROM worker_trades WHERE trade = $1";
const BY_SKILL = "SELECT user_id FROM worker_skills WHERE skill_key = $1";

/**
 * Active workers of one trade or skill within the radius, nearest first, then cheapest. Distance is the haversine
 * formula in SQL; a latitude band (served by an index) keeps it from running over every worker of the trade. With a
 * day and part of the day (ADR 0050): only workers whose hours include them, and none with a signed job then on
 * GigSync's record (the same window on that date, or every day). Bookings on phones are not seen here.
 */
export async function searchWorkers(db: Db, q: BoardQuery): Promise<BoardWorker[]> {
  const date = q.day !== undefined && q.day !== EVERY_DAY ? q.day : null;
  const { rows } = await db.query<BoardRow>(
    `SELECT p.user_id, ${CARD_COLUMNS}, d.km AS distance_km
     FROM (${q.skill === undefined ? BY_TRADE : BY_SKILL}) w
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
       AND ($13::text IS NULL OR p.work_windows IS NULL OR $13::text = ANY (p.work_windows))
       AND NOT ($13::text IS NOT NULL AND ($11::date IS NOT NULL OR $14::boolean) AND EXISTS (
         SELECT 1 FROM job_records j WHERE j.worker_id = p.user_id AND j.status = 'agreed' AND j.work_window = $13
           AND (j.work_daily OR j.work_day = $11::date)))
     ORDER BY d.km, p.rate_paise, p.user_id
     LIMIT $6`,
    [
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
    ],
  );
  return rows.map((r) => ({
    ...cardOf(r),
    user: r.user_id,
    distance_km: Math.round(r.distance_km * DISTANCE_SCALE) / DISTANCE_SCALE,
  }));
}

async function cardRow(db: Db, user: UserId): Promise<CardRow | undefined> {
  const { rows } = await db.query<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM worker_profiles p
     JOIN users u ON u.user_id = p.user_id AND u.status = 'active'
     WHERE p.user_id = $1`,
    [user],
  );
  return rows[0];
}

/** One active worker's card as served, or undefined when they have none on the board. */
export async function workerCard(db: Db, user: UserId): Promise<BoardProfile | undefined> {
  const r = await cardRow(db, user);
  return r && cardOf(r);
}

/** The caller's own card with their switch, or undefined when they have none on the board. */
export async function myCard(db: Db, user: UserId): Promise<MyBoardProfile | undefined> {
  const r = await cardRow(db, user);
  return r && myCardOf(r);
}

/** True when the worker has a card on the board. */
export async function isListed(db: Db, user: UserId): Promise<boolean> {
  const { rows } = await db.query<{ listed: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM worker_profiles WHERE user_id = $1) AS listed",
    [user],
  );
  return rows[0]?.listed ?? false;
}
