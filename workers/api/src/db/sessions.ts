import type { DeviceId, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

export interface SessionOwner {
  user_id: UserId;
  device_id: DeviceId;
}

/** Who a bearer token belongs to, or undefined when it is unknown or revoked. */
export async function sessionOwner(db: Db, token: string): Promise<SessionOwner | undefined> {
  const { rows } = await db.query<SessionOwner>(
    "SELECT user_id, device_id FROM sessions WHERE token = $1 AND revoked_at IS NULL",
    [token],
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
