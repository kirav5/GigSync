import { verify } from "@gigsync/crypto";
import { agreeBytes, type DeviceId } from "@gigsync/protocol";
import type { DeviceKeys } from "../db/devices.js";

/**
 * Which of the sender's active devices made this `agree` signature over `hash`, or undefined when none did: a revoked
 * device's key is not in `keys`, so its signatures no longer count.
 */
export function signingDevice(keys: readonly DeviceKeys[], hash: string, sig: string): DeviceId | undefined {
  const bytes = agreeBytes(hash);
  return keys.find((k) => verify(bytes, sig, k.signing_key))?.device_id;
}
