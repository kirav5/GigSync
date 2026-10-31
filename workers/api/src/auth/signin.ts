import type { DeviceId, DeviceRegistration, UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { type Db, transaction } from "../db/client.js";
import { insertDevice } from "../db/devices.js";
import { insertSession } from "../db/sessions.js";
import { insertUser, userForPhone } from "../db/users.js";
import { clearFailures } from "./attempts.js";

export interface SignedIn {
  user: UserId;
  device: DeviceId;
  token: string;
}

/**
 * Finds or creates the user for a verified number and registers this device with a new session. Every write runs
 * in one transaction, so a failure part-way never leaves a user without a device or a device without a session.
 */
export async function completeSignIn(
  db: Db,
  phoneHmac: string,
  device: DeviceRegistration,
  now: Date,
): Promise<SignedIn> {
  const deviceId = `dev_${ulid()}` as DeviceId;
  const token = `ses_${ulid()}`;
  return transaction(db, async () => {
    const existing = await userForPhone(db, phoneHmac);
    const user = existing ?? (`usr_${ulid()}` as UserId);
    if (!existing) await insertUser(db, user, phoneHmac, now);
    await insertDevice(db, deviceId, user, device, now);
    await insertSession(db, token, user, deviceId, now);
    await clearFailures(db, phoneHmac);
    return { user, device: deviceId, token };
  });
}
