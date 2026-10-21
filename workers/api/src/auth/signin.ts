import type { DeviceId, DeviceRegistration, UserId } from "@collab/protocol";
import { ulid } from "ulid";
import { clearFailures } from "./attempts.js";

export interface SignedIn {
  user: UserId;
  device: DeviceId;
  token: string;
}

/**
 * Finds or creates the user for a verified number and registers this device with a new session. Every write runs
 * in one batch (a transaction), so a failure part-way never leaves a user without a device or a device without a
 * session.
 */
export async function completeSignIn(
  db: D1Database,
  phoneHmac: string,
  device: DeviceRegistration,
  now: Date,
): Promise<SignedIn> {
  const at = now.toISOString();
  const existing = await db
    .prepare("SELECT user_id FROM phone_bindings WHERE phone_hmac = ?")
    .bind(phoneHmac)
    .first<{ user_id: UserId }>();
  const user = existing?.user_id ?? (`usr_${ulid()}` as UserId);
  const deviceId = `dev_${ulid()}` as DeviceId;
  const token = `ses_${ulid()}`;

  const newUser = existing
    ? []
    : [
        db.prepare("INSERT INTO users (user_id, created_at, status) VALUES (?, ?, 'active')").bind(user, at),
        db
          .prepare("INSERT INTO phone_bindings (phone_hmac, user_id, verified_at) VALUES (?, ?, ?)")
          .bind(phoneHmac, user, at),
      ];
  await db.batch([
    ...newUser,
    db
      .prepare(
        `INSERT INTO devices (device_id, user_id, signing_key, encryption_key, protocol, push_token, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        deviceId,
        user,
        device.signing_key,
        device.encryption_key,
        device.protocol,
        device.push_token ?? null,
        at,
        at,
      ),
    db
      .prepare("INSERT INTO sessions (token, user_id, device_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(token, user, deviceId, at),
    clearFailures(db, phoneHmac),
  ]);
  return { user, device: deviceId, token };
}
