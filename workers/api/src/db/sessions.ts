import type { DeviceId, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

export interface SessionOwner {
  user_id: UserId;
  device_id: DeviceId;
}

/**
 * How long a session lasts from sign-in. Long, because signing in again costs an SMS and a household may open the app
 * once a month; short enough that a token copied off a lost phone stops working on its own.
 */
export const SESSION_DAYS = 180;
/** The one status that may use the API: a frozen or deleted account is refused even with a good token. */
const ACTIVE = "active";

/** Who a bearer token belongs to, or undefined when it is unknown, revoked, expired, or the account is not active. */
export async function sessionOwner(db: Db, token: string): Promise<SessionOwner | undefined> {
  const { rows } = await db.query<SessionOwner>(
    `SELECT s.user_id, s.device_id FROM sessions s
     JOIN users u ON u.user_id = s.user_id AND u.status = $3
     WHERE s.token = $1 AND s.revoked_at IS NULL AND s.created_at > now() - make_interval(days => $2)`,
    [token, SESSION_DAYS, ACTIVE],
  );
  return rows[0];
}

export async function insertSession(db: Db, token: string, user: UserId, device: DeviceId, at: Date): Promise<void> {
  await db.query("INSERT INTO sessions (token, user_id, device_id, created_at) VALUES ($1, $2, $3, $4)", [
    token,
    user,
    device,
    at,
  ]);
}
