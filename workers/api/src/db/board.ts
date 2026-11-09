import {
  type ArrangementRate,
  type BoardProfile,
  type MyBoardProfile,
  type Skill,
  skillKey,
  type TimeWindow,
  type Trade,
  type UserId,
  type WorkHours,
  type WorkRate,
} from "@gigsync/protocol";
import { recordOf } from "../records/serve.js";
import type { Db } from "./client.js";
import { RECORD_COLUMNS, type RecordRow } from "./records.js";

/** Areas are stored to two decimal places of a degree: about 1.1 km, a neighbourhood rather than a building. */
const AREA_SCALE = 100;

export const roundArea = (degrees: number) => Math.round(degrees * AREA_SCALE) / AREA_SCALE;

/**
 * Publishes or replaces a worker's card, trades and languages together, and their Show my record switch (unchanged
 * when not sent; a new card shows it). A `record` sent with the card is ignored: the server computes it (ADR 0038).
 * Call inside a transaction.
 */
export async function upsertProfile(db: Db, user: UserId, p: BoardProfile, at: Date): Promise<void> {
  await db.query(
    `INSERT INTO worker_profiles (user_id, display_name, area_lat, area_lon, area_name, rate_paise, about, updated_at,
       show_record, work_days, work_windows, work_from, work_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE), $10, $11, $12, $13)
     ON CONFLICT (user_id) DO UPDATE SET display_name = excluded.display_name, area_lat = excluded.area_lat,
       area_lon = excluded.area_lon, area_name = excluded.area_name, rate_paise = excluded.rate_paise,
       about = excluded.about, updated_at = excluded.updated_at,
       show_record = COALESCE($9, worker_profiles.show_record),
       work_days = excluded.work_days, work_windows = excluded.work_windows,
       work_from = excluded.work_from, work_to = excluded.work_to`,
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
      p.work_hours?.from ?? null,
      p.work_hours?.to ?? null,
    ],
  );
  const own = ownRates(p.work_rates);
  await db.query("DELETE FROM worker_trades WHERE user_id = $1", [user]);
  await db.query(
    "INSERT INTO worker_trades (user_id, trade, rate_paise) SELECT $1, unnest($2::text[]), unnest($3::int[])",
    [user, p.trades, p.trades.map((tr) => own.trades.get(tr) ?? null)],
  );
  await db.query("DELETE FROM worker_languages WHERE user_id = $1", [user]);
  await db.query("INSERT INTO worker_languages (user_id, language) SELECT $1, unnest($2::text[])", [user, p.languages]);
  const skills = p.skills ?? [];
  const { rows: before } = await db.query<{ skill_key: string; category: string | null }>(
    "DELETE FROM worker_skills WHERE user_id = $1 RETURNING skill_key, category",
    [user],
  );
  // A phone's copy of the card may predate a category set here: a card sent again must not lose it.
  const kept = new Map(before.map((row) => [row.skill_key, row.category]));
  await db.query(
    "INSERT INTO worker_skills (user_id, skill_key, text, lang, category, rate_paise) SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[]), unnest($5::text[]), unnest($6::int[])",
    [
      user,
      skills.map((k) => skillKey(k.text)),
      skills.map((k) => k.text),
      skills.map((k) => k.lang),
      skills.map((k) => k.category ?? kept.get(skillKey(k.text)) ?? null),
      skills.map((k) => own.skills.get(skillKey(k.text)) ?? null),
    ],
  );
  const arrangements = p.arrangements ?? [];
  await db.query("DELETE FROM worker_arrangements WHERE user_id = $1", [user]);
  await db.query(
    "INSERT INTO worker_arrangements (user_id, arrangement, rate_paise) SELECT $1, unnest($2::text[]), unnest($3::int[])",
    [user, arrangements.map((a) => a.arrangement), arrangements.map((a) => a.rate_paise)],
  );
}

/** A card's rates of its own (ADR 0062), by trade and by skill key. */
function ownRates(rates: readonly WorkRate[] = []): { trades: Map<Trade, number>; skills: Map<string, number> } {
  const trades = new Map<Trade, number>();
  const skills = new Map<string, number>();
  for (const r of rates) {
    if ("trade" in r) trades.set(r.trade, r.rate_paise);
    else skills.set(r.skill, r.rate_paise);
  }
  return { trades, skills };
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
  p.work_days, p.work_windows, p.work_from, p.work_to,
  ARRAY(SELECT t.trade FROM worker_trades t WHERE t.user_id = p.user_id ORDER BY t.trade) AS trades,
  ARRAY(SELECT json_strip_nulls(json_build_object('text', s.text, 'lang', s.lang, 'category', s.category))
    FROM worker_skills s WHERE s.user_id = p.user_id ORDER BY s.skill_key) AS skills,
  ARRAY(SELECT json_build_object('trade', t.trade, 'rate_paise', t.rate_paise) FROM worker_trades t
    WHERE t.user_id = p.user_id AND t.rate_paise IS NOT NULL ORDER BY t.trade) AS trade_rates,
  ARRAY(SELECT json_build_object('skill', s.skill_key, 'rate_paise', s.rate_paise) FROM worker_skills s
    WHERE s.user_id = p.user_id AND s.rate_paise IS NOT NULL ORDER BY s.skill_key) AS skill_rates,
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
  /** ADR 0053 §1: the hours on the clock they work, both or neither; NULL when the card gives parts of the day only. */
  work_from: number | null;
  work_to: number | null;
  trades: Trade[];
  /** ADR 0047: the worker's own skills; empty for a card that lists trades only. */
  skills: Skill[];
  languages: string[];
  /** Empty for a card that takes monthly work only. */
  arrangements: ArrangementRate[];
  /** ADR 0062: the trades and skills with a rate of their own; empty when every kind is at the card's rate. */
  trade_rates: WorkRate[];
  skill_rates: WorkRate[];
}

/** The card's working hours, with the hours on the clock when it has them. */
const hoursOf = (r: CardRow, days: number[], windows: TimeWindow[]): WorkHours =>
  r.work_from !== null && r.work_to !== null ? { days, windows, from: r.work_from, to: r.work_to } : { days, windows };

const withWorkRates = (rates: WorkRate[]): { work_rates?: WorkRate[] } =>
  rates.length > 0 ? { work_rates: rates } : {};

/** The card's own fields, without the record. */
const fieldsOf = (r: CardRow): BoardProfile => ({
  display_name: r.display_name,
  trades: r.trades,
  ...(r.skills.length > 0 ? { skills: r.skills } : {}),
  area: { lat: r.area_lat, lon: r.area_lon },
  area_name: r.area_name,
  rate_paise: r.rate_paise,
  ...withWorkRates([...r.trade_rates, ...r.skill_rates]),
  languages: r.languages,
  about: r.about,
  ...(r.arrangements.length > 0 ? { arrangements: r.arrangements } : {}),
  ...(r.work_days && r.work_windows ? { work_hours: hoursOf(r, r.work_days, r.work_windows) } : {}),
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
