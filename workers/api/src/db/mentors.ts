import {
  type City,
  type Lang,
  MATCH_LIMIT,
  type MatchRequest,
  type MentorListing,
  type MentorProfile,
  type MyMentorListing,
  REPORT_SUSPEND,
  type Trade,
  type UserId,
} from "@gigsync/protocol";
import type { Db } from "./client.js";

/** The columns a newcomer may see, plus each listing's trades and languages in a stable order. */
const PROFILE_COLUMNS = `l.user_id, l.first_name, l.city, l.area, l.months, l.jobs, l.vouched_by,
  ARRAY(SELECT t.trade FROM mentor_trades t WHERE t.user_id = l.user_id ORDER BY t.trade) AS trades,
  ARRAY(SELECT g.language FROM mentor_languages g WHERE g.user_id = l.user_id ORDER BY g.language) AS languages`;

interface ProfileRow {
  user_id: UserId;
  first_name: string;
  city: City;
  area: string;
  months: number;
  jobs: number;
  vouched_by: string | null;
  trades: Trade[];
  languages: Lang[];
}

interface OwnRow extends ProfileRow {
  open_slots: number;
  woman: boolean;
  women_only_newcomers: boolean;
  active: boolean;
}

const profile = (r: ProfileRow): MentorProfile => ({
  user: r.user_id,
  first_name: r.first_name,
  city: r.city,
  area: r.area,
  trades: r.trades,
  languages: r.languages,
  months: r.months,
  jobs: r.jobs,
  vouched_by: r.vouched_by,
});

/** Publishes or replaces the caller's listing, trades and languages together; keeps any vouch. Call in a transaction. */
export async function upsertListing(db: Db, user: UserId, l: MentorListing, at: Date): Promise<void> {
  await db.query(
    `INSERT INTO mentor_listings (user_id, first_name, city, area, months, jobs, open_slots, woman,
       women_only_newcomers, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id) DO UPDATE SET first_name = excluded.first_name, city = excluded.city,
       area = excluded.area, months = excluded.months, jobs = excluded.jobs, open_slots = excluded.open_slots,
       woman = excluded.woman, women_only_newcomers = excluded.women_only_newcomers, active = excluded.active,
       updated_at = excluded.updated_at`,
    [user, l.first_name, l.city, l.area, l.months, l.jobs, l.open_slots, l.woman, l.women_only_newcomers, l.active, at],
  );
  await db.query("DELETE FROM mentor_trades WHERE user_id = $1", [user]);
  await db.query("INSERT INTO mentor_trades (user_id, trade) SELECT $1, unnest($2::text[])", [user, l.trades]);
  await db.query("DELETE FROM mentor_languages WHERE user_id = $1", [user]);
  await db.query("INSERT INTO mentor_languages (user_id, language) SELECT $1, unnest($2::text[])", [user, l.languages]);
}

/** The caller's own listing as stored, woman flag and vouch included, or undefined when they have none. */
export async function ownListing(db: Db, user: UserId): Promise<MyMentorListing["listing"] | undefined> {
  const { rows } = await db.query<OwnRow>(
    `SELECT ${PROFILE_COLUMNS}, l.open_slots, l.woman, l.women_only_newcomers, l.active
     FROM mentor_listings l WHERE l.user_id = $1`,
    [user],
  );
  const [r] = rows;
  if (!r) return undefined;
  const { user: _user, ...shown } = profile(r);
  return {
    ...shown,
    open_slots: r.open_slots,
    woman: r.woman,
    women_only_newcomers: r.women_only_newcomers,
    active: r.active,
  };
}

/** Switches the caller's listing off for good. True when there was one; trades and languages go with it. */
export async function removeListing(db: Db, user: UserId): Promise<boolean> {
  const { rowCount } = await db.query("DELETE FROM mentor_listings WHERE user_id = $1", [user]);
  return (rowCount ?? 0) > 0;
}

/** Sets or clears the vouched badge. False when the person has no listing. */
export async function setVouch(db: Db, user: UserId, vouchedBy: string | null): Promise<boolean> {
  const { rowCount } = await db.query("UPDATE mentor_listings SET vouched_by = $2 WHERE user_id = $1", [
    user,
    vouchedBy,
  ]);
  return (rowCount ?? 0) > 0;
}

/**
 * Listings a newcomer may pick from, most jobs first. The rules, all fixed here and none chosen by a model: same
 * city, the trade among theirs, the language among theirs, a slot open, listing on and account active; only women
 * when the newcomer asked for women only; a women-only-newcomers listing only for a newcomer who said she is a woman;
 * never the caller, never a pair either of whom blocked the other, never someone with REPORT_SUSPEND open reports.
 */
export async function matchMentors(db: Db, caller: UserId, q: MatchRequest): Promise<MentorProfile[]> {
  const { rows } = await db.query<ProfileRow>(
    `SELECT ${PROFILE_COLUMNS}
     FROM mentor_listings l
     JOIN users u ON u.user_id = l.user_id AND u.status = 'active'
     WHERE l.city = $1 AND l.active AND l.open_slots > 0 AND l.user_id <> $4
       AND EXISTS (SELECT 1 FROM mentor_trades t WHERE t.user_id = l.user_id AND t.trade = $2)
       AND EXISTS (SELECT 1 FROM mentor_languages g WHERE g.user_id = l.user_id AND g.language = $3)
       AND (NOT $5::boolean OR l.woman)
       AND (NOT (l.woman AND l.women_only_newcomers) OR $6::boolean)
       AND NOT EXISTS (SELECT 1 FROM mentor_blocks b
         WHERE (b.blocker_id = $4 AND b.blocked_id = l.user_id) OR (b.blocker_id = l.user_id AND b.blocked_id = $4))
       AND (SELECT count(*) FROM mentor_reports r WHERE r.reported_id = l.user_id AND r.reviewed_at IS NULL) < $7
     ORDER BY l.jobs DESC, l.user_id
     LIMIT $8`,
    [q.city, q.trade, q.lang, caller, q.women_only, q.woman, REPORT_SUSPEND, MATCH_LIMIT],
  );
  return rows.map(profile);
}
