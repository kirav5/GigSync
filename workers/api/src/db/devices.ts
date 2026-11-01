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

/** The signing key of one of a user's active devices, or undefined when it is unknown or revoked. */
export async function deviceSigningKey(db: Db, user: UserId, device: DeviceId): Promise<string | undefined> {
  const { rows } = await db.query<{ signing_key: string }>(
    "SELECT signing_key FROM devices WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [device, user],
  );
  return rows[0]?.signing_key;
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

/** Where the caller's own active device takes pushes, or none (null). False when the device is unknown or revoked. */
export async function setPushEndpoint(
  db: Db,
  device: DeviceId,
  user: UserId,
  endpoint: string | null,
): Promise<boolean> {
  const { rowCount } = await db.query(
    "UPDATE devices SET push_token = $3 WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [device, user, endpoint],
  );
  return (rowCount ?? 0) > 0;
}

/** The push addresses of a user's active devices that gave one: where a job message's wake-up goes. */
export async function pushEndpoints(db: Db, user: UserId): Promise<string[]> {
  const { rows } = await db.query<{ push_token: string }>(
    "SELECT push_token FROM devices WHERE user_id = $1 AND revoked_at IS NULL AND push_token IS NOT NULL",
    [user],
  );
  return rows.map((r) => r.push_token);
}

/** Records that the caller's own device now speaks `protocol`; never lowers it. False when the device is unknown or revoked. */
export async function raiseProtocol(db: Db, device: DeviceId, user: UserId, protocol: number): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE devices SET protocol = GREATEST(protocol, $3)
     WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [device, user, protocol],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Revokes one of `user`'s active devices and every session it holds; call in a transaction. False when the device is
 * not theirs or already revoked.
 */
export async function revokeDevice(db: Db, user: UserId, device: DeviceId, at: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    "UPDATE devices SET revoked_at = $3 WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [device, user, at],
  );
  if ((rowCount ?? 0) === 0) return false;
  await db.query("UPDATE sessions SET revoked_at = $2 WHERE device_id = $1 AND revoked_at IS NULL", [device, at]);
  return true;
}
