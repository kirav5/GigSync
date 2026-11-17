import {
  type DeviceId,
  type DeviceRegistration,
  isNativePush,
  MAX_RECIPIENT_DEVICES,
  PushAddress,
  type UserId,
} from "@gigsync/protocol";
import type { Db } from "./client.js";

/** A device's public keys as the directory lists them. Never the push token: that stays server-side. */
export interface DeviceKeys {
  device_id: DeviceId;
  signing_key: string;
  encryption_key: string;
  protocol: number;
}

/**
 * The devices a person is reached on: not revoked, newest first, no more than an envelope can carry keys for. A person
 * with older rows past that cap (from before sign-ins reused them) is reached on the newest, never on none.
 */
const REACHABLE = `FROM devices WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC, device_id DESC
  LIMIT ${MAX_RECIPIENT_DEVICES}`;

/** A user's devices that are not revoked, with the keys needed to reach them. */
export async function activeDevices(db: Db, user: UserId): Promise<DeviceKeys[]> {
  const { rows } = await db.query<DeviceKeys>(`SELECT device_id, signing_key, encryption_key, protocol ${REACHABLE}`, [
    user,
  ]);
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
  const { rows } = await db.query<{ device_id: DeviceId }>(`SELECT device_id ${REACHABLE}`, [user]);
  return rows.map((r) => r.device_id);
}

/** The user's active device with these keys, if they signed in on this phone before and never signed out. */
export async function deviceWithKey(db: Db, user: UserId, signingKey: string): Promise<DeviceId | undefined> {
  const { rows } = await db.query<{ device_id: DeviceId }>(
    "SELECT device_id FROM devices WHERE user_id = $1 AND signing_key = $2 AND revoked_at IS NULL LIMIT 1",
    [user, signingKey],
  );
  return rows[0]?.device_id;
}

/** The same phone signing in again: what it now speaks and where it takes pushes, without a new row. */
export async function refreshDevice(db: Db, device: DeviceId, reg: DeviceRegistration, at: Date): Promise<void> {
  await db.query(
    `UPDATE devices SET encryption_key = $2, protocol = GREATEST(protocol, $3),
       push_token = COALESCE($4, push_token), last_seen = $5
     WHERE device_id = $1`,
    [device, reg.encryption_key, reg.protocol, reg.push_token ?? null, at],
  );
}

/** Revokes devices and their sessions together: a revoked device must not keep a working token. */
async function revoke(db: Db, devices: readonly DeviceId[], at: Date): Promise<void> {
  if (devices.length === 0) return;
  await db.query("UPDATE devices SET revoked_at = $2 WHERE device_id = ANY($1) AND revoked_at IS NULL", [devices, at]);
  await db.query("UPDATE sessions SET revoked_at = $2 WHERE device_id = ANY($1) AND revoked_at IS NULL", [devices, at]);
}

/**
 * Room for one more device: the oldest are retired, so a person never has more than an envelope can reach. Returns
 * the retired devices, for the caller to forget their sessions.
 */
export async function makeRoomForDevice(db: Db, user: UserId, at: Date): Promise<DeviceId[]> {
  const { rows } = await db.query<{ device_id: DeviceId }>(
    `SELECT device_id FROM devices WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC, device_id DESC OFFSET $2`,
    [user, MAX_RECIPIENT_DEVICES - 1],
  );
  const retired = rows.map((r) => r.device_id);
  await revoke(db, retired, at);
  return retired;
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

/**
 * Where the caller's own active device takes pushes, or none (null). A subscription with its keys, or the Android
 * app's FCM token with its language (ADR 0067), is kept whole, as JSON, in `push_token`; an older app's bare address
 * as it came. False when the device is unknown or revoked.
 */
export async function setPushAddress(
  db: Db,
  device: DeviceId,
  user: UserId,
  address: PushAddress | null,
): Promise<boolean> {
  const bare = address && !isNativePush(address) && !address.keys;
  const token = address && (bare ? address.endpoint : JSON.stringify(address));
  const { rowCount } = await db.query(
    "UPDATE devices SET push_token = $3 WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [device, user, token],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * A stored `push_token` read back: a whole subscription, an FCM token, or a bare address; anything else is not a push
 * address.
 */
function addressOf(token: string): PushAddress | undefined {
  let value: unknown = { endpoint: token };
  try {
    if (token.startsWith("{")) value = JSON.parse(token);
  } catch {
    return undefined;
  }
  const parsed = PushAddress.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** The push addresses of a user's active devices that gave one: where a job message's notification goes. */
export async function pushAddresses(db: Db, user: UserId): Promise<PushAddress[]> {
  const { rows } = await db.query<{ push_token: string }>(
    "SELECT push_token FROM devices WHERE user_id = $1 AND revoked_at IS NULL AND push_token IS NOT NULL",
    [user],
  );
  return rows.map((r) => addressOf(r.push_token)).filter((a) => a !== undefined);
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

/** The capability number the caller's own device reports; 0 when it is unknown or revoked. */
export async function deviceProtocol(db: Db, device: DeviceId, user: UserId): Promise<number> {
  const { rows } = await db.query<{ protocol: number }>(
    "SELECT protocol FROM devices WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [device, user],
  );
  return rows[0]?.protocol ?? 0;
}
