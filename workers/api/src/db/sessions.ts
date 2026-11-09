import type { DeviceId, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

export interface SessionOwner {
  user_id: UserId;
  device_id: DeviceId;
}

/** A session the directory vouched for, and when it ends on its own (epoch milliseconds). */
export interface LiveSession {
  owner: SessionOwner;
  endsAt: number;
}

/**
 * How long a session lasts from sign-in. Long, because signing in again costs an SMS and a household may open the app
 * once a month; short enough that a token copied off a lost phone stops working on its own.
 */
export const SESSION_DAYS = 180;
const DAY_MS = 86_400_000;
/** The one status that may use the API: a frozen or deleted account is refused even with a good token. */
const ACTIVE = "active";

/**
 * The same parameters for every request with one token, and no clock in the statement: the expiry is checked here in
 * the Worker, so Hyperdrive can answer a repeat of this lookup from its cache instead of waking Postgres.
 */
const OWNER = `SELECT s.user_id, s.device_id, s.created_at FROM sessions s
     JOIN users u ON u.user_id = s.user_id AND u.status = $2
     WHERE s.token = $1 AND s.revoked_at IS NULL`;
/**
 * The same lookup for routes that must hear of a revoked session or frozen account at once. `now()` is there on
 * purpose and changes no row: Hyperdrive never caches a statement that calls a volatile or stable function, so this
 * one always reaches Postgres.
 */
const OWNER_FROM_POSTGRES = `${OWNER} AND now() IS NOT NULL`;

type OwnerRow = SessionOwner & { created_at: Date };

/**
 * Who a bearer token belongs to at `now`, or undefined when it is unknown, revoked, expired, or the account is not
 * active. `fresh` asks Postgres itself; without it Hyperdrive may answer from its own short cache.
 */
export async function sessionOwner(
  db: Db,
  token: string,
  now: number,
  fresh: boolean,
): Promise<LiveSession | undefined> {
  const { rows } = await db.query<OwnerRow>(fresh ? OWNER_FROM_POSTGRES : OWNER, [token, ACTIVE]);
  const row = rows[0];
  if (!row) return undefined;
  const endsAt = row.created_at.getTime() + SESSION_DAYS * DAY_MS;
  if (endsAt <= now) return undefined;
  return { owner: { user_id: row.user_id, device_id: row.device_id }, endsAt };
}

export async function insertSession(db: Db, token: string, user: UserId, device: DeviceId, at: Date): Promise<void> {
  await db.query("INSERT INTO sessions (token, user_id, device_id, created_at) VALUES ($1, $2, $3, $4)", [
    token,
    user,
    device,
    at,
  ]);
}
