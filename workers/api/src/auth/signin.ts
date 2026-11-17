import type { DeviceId, DeviceRegistration, UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { type Db, transaction } from "../db/client.js";
import { deviceWithKey, insertDevice, makeRoomForDevice, refreshDevice } from "../db/devices.js";
import { insertSession } from "../db/sessions.js";
import { insertUser, userForPhone } from "../db/users.js";
import { clearFailures } from "./attempts.js";
import { sessionCache } from "./session-cache.js";

export interface SignedIn {
  user: UserId;
  device: DeviceId;
  token: string;
}

/**
 * Finds or creates the user for a verified number and registers this device with a new session. A phone that signed
 * in before with the same keys keeps its device row; a new one first retires the oldest past the cap, so a person never
 * has more devices than an envelope can carry keys for. Every write runs in one transaction, so a failure part-way
 * never leaves a user without a device or a device without a session.
 */
export async function completeSignIn(
  db: Db,
  phoneHmac: string,
  device: DeviceRegistration,
  now: Date,
): Promise<SignedIn> {
  const token = `ses_${ulid()}`;
  let retired: DeviceId[] = [];
  const signedIn = await transaction(db, async () => {
    const existing = await userForPhone(db, phoneHmac);
    const user = existing ?? (`usr_${ulid()}` as UserId);
    if (!existing) await insertUser(db, user, phoneHmac, now);
    const known = existing ? await deviceWithKey(db, user, device.signing_key) : undefined;
    const deviceId = known ?? (`dev_${ulid()}` as DeviceId);
    if (known) await refreshDevice(db, known, device, now);
    else {
      retired = await makeRoomForDevice(db, user, now);
      await insertDevice(db, deviceId, user, device, now);
    }
    await insertSession(db, token, user, deviceId, now);
    await clearFailures(db, phoneHmac);
    return { user, device: deviceId, token };
  });
  // Only once the retirement is committed: this isolate stops honouring the retired phones' tokens at once.
  sessionCache.forgetDevices(retired, now.getTime());
  return signedIn;
}
