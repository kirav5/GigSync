import type { UserId } from "@gigsync/protocol";
import { HttpError, type Relay } from "./api.js";

const NOT_FOUND = 404;

/**
 * True when `user` has a phone signed in and every one of their phones reports at least `protocol` (the capability
 * number each device registers at sign-in). A body a phone cannot parse stalls the job on that phone, so one old
 * phone is enough to say no.
 */
export async function everyDeviceSpeaks(relay: Relay, user: UserId, protocol: number): Promise<boolean> {
  try {
    const { devices } = await relay.directory(user);
    return devices.length > 0 && devices.every((d) => d.protocol >= protocol);
  } catch (err) {
    // The directory answers 404 for someone with no active phone: there is nobody to reach.
    if (err instanceof HttpError && err.status === NOT_FOUND) return false;
    throw err;
  }
}
