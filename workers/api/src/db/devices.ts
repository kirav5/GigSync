import type { DeviceId, DeviceRegistration, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** A device's public keys as the directory lists them. Never the push token: that stays server-side. */
export interface DeviceKeys {
  device_id: DeviceId;
  signing_key: string;
  encryption_key: string;
  protocol: number;
}

/** A user's devices that are not revoked, with the keys needed to reach them. */
export async function activeDevices(db: Db, user: UserId): Promise<DeviceKeys[]> {
  const { rows } = await db.query<DeviceKeys>(
    "SELECT device_id, signing_key, encryption_key, protocol FROM devices WHERE user_id = $1 AND revoked_at IS NULL",
    [user],
  );
  return rows;
}

/** Just the ids of a user's active devices: where the mailbox fans an envelope out to. */
export async function activeDeviceIds(db: Db, user: UserId): Promise<DeviceId[]> {
  const { rows } = await db.query<{ device_id: DeviceId }>(
    "SELECT device_id FROM devices WHERE user_id = $1 AND revoked_at IS NULL",
    [user],
  );
  return rows.map((r) => r.device_id);
}

export async function insertDevice(
  db: Db,
  device: DeviceId,
  user: UserId,
  reg: DeviceRegistration,
  at: Date,
): Promise<void> {
  await db.query(
    `INSERT INTO devices (device_id, user_id, signing_key, encryption_key, protocol, push_token, created_at, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [device, user, reg.signing_key, reg.encryption_key, reg.protocol, reg.push_token ?? null, at],
  );
}
