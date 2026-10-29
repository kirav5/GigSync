import { newDeviceSecrets } from "@gigsync/crypto";
import type { ContactCard, DeviceId, UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { GigDevice, MemoryStorage, OwnerStorage, SecretKeys, SystemClock } from "../src/index.js";
import type { MemoryRelay } from "./phones.js";
import { nextPhoneRandom } from "./random.js";

/** Two people who sign in, one after the other, on one shared phone. */
export function phoneOwners() {
  return {
    phone: new MemoryStorage(),
    sita: `usr_${ulid()}` as UserId,
    geeta: `usr_${ulid()}` as UserId,
  };
}

/** One phone: its storage and its device keys, shared by everyone who signs in on it. */
export interface SharedPhone {
  storage: MemoryStorage;
  keys: SecretKeys;
}

export const sharedPhone = (): SharedPhone => ({
  storage: new MemoryStorage(),
  keys: new SecretKeys(newDeviceSecrets()),
});

export interface SignedIn {
  me: { user: UserId; device: DeviceId };
  device: GigDevice;
}

/**
 * Someone signs in on the shared phone, as the app does: the phone's keys, its storage seen as theirs. A new person
 * registers the phone's keys under their account; `again` signs a person back in as they were.
 */
export async function signInOn(
  phone: SharedPhone,
  relay: MemoryRelay,
  contact: ContactCard,
  again?: SignedIn["me"],
): Promise<SignedIn> {
  const me = again ?? { user: `usr_${ulid()}` as UserId, device: `dev_${ulid()}` as DeviceId };
  if (!again) relay.register(me.user, me.device, await phone.keys.publicKeys());
  const device = new GigDevice({
    relay: relay.for(me),
    storage: new OwnerStorage(phone.storage, me.user),
    keys: phone.keys,
    clock: new SystemClock(),
    random: nextPhoneRandom(),
    me,
    contact,
  });
  return { me, device };
}
