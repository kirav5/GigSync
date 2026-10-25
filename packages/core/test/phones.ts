import { type DevicePublicKeys, newDeviceSecrets, verify } from "@gigsync/crypto";
import {
  type ContactCard,
  type DeviceId,
  type DeviceKeys,
  type Envelope,
  type MessageId,
  signingBytes,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import {
  GigDevice,
  HttpError,
  MemoryStorage,
  type NewNeed,
  type Relay,
  SecretKeys,
  SystemClock,
  type WorkerRules,
} from "../src/index.js";

/** The mailbox and directory in memory, checking signatures as workers/api does. */
export class MemoryRelay {
  private readonly devices = new Map<UserId, DeviceKeys[]>();
  private readonly boxes = new Map<DeviceId, Envelope[]>();
  /** Every envelope the relay accepted, as the server would store it. */
  readonly stored: Envelope[] = [];

  register(user: UserId, device: DeviceId, keys: DevicePublicKeys) {
    this.devices.set(user, [...(this.devices.get(user) ?? []), { device_id: device, protocol: 1, ...keys }]);
    this.boxes.set(device, []);
  }

  for(me: { user: UserId; device: DeviceId }): Relay {
    return {
      directory: async (user) => ({ user, devices: this.devices.get(user) ?? [] }),
      deliver: async (e: Envelope) => {
        const key = this.devices.get(e.from.user)?.find((d) => d.device_id === e.from.device)?.signing_key;
        if (e.from.device !== me.device || !key || !verify(signingBytes(e), e.sig, key))
          throw new HttpError(403, "bad signature");
        const to = this.devices.get(e.to.user) ?? [];
        if (to.length === 0) throw new HttpError(404, "recipient not found");
        this.stored.push(e);
        for (const d of to) this.boxes.get(d.device_id)?.push(e);
        return { stored: true, devices: to.length };
      },
      inbox: async () => [...(this.boxes.get(me.device) ?? [])],
      ack: async (ids: MessageId[]) => {
        this.boxes.set(
          me.device,
          (this.boxes.get(me.device) ?? []).filter((e) => !ids.includes(e.id)),
        );
        return { acked: ids.length };
      },
    };
  }
}

export interface Phone {
  user: UserId;
  device: GigDevice;
}

export async function phone(
  relay: MemoryRelay,
  contact: ContactCard,
  opts: { worker?: WorkerRules; autoConfirm?: boolean } = {},
): Promise<Phone> {
  const keys = new SecretKeys(newDeviceSecrets());
  const me = { user: `usr_${ulid()}` as UserId, device: `dev_${ulid()}` as DeviceId };
  relay.register(me.user, me.device, await keys.publicKeys());
  const device = new GigDevice({
    relay: relay.for(me),
    storage: new MemoryStorage(),
    keys,
    clock: new SystemClock(),
    me,
    contact,
    ...opts,
  });
  return { user: me.user, device };
}

export const BENGALURU = { lat: 12.97, lon: 77.64 };

export function electrician(min = 55000, rate = 70000): WorkerRules {
  return {
    trades: ["electrician"],
    rate: { opening_paise: rate, limit_paise: min },
    base: BENGALURU,
    radius_km: 10,
    vpa: "ravi.test@okaxis",
    payee_name: "Ravi Electricals",
  };
}

export const fanNeed = (budget = 65000, details: Record<string, string> = {}): NewNeed => ({
  trade: "electrician",
  need: "Ceiling fan stopped working",
  when: "tomorrow 10:00",
  area: { lat: 12.975, lon: 77.645 },
  details,
  budget: { opening_paise: Math.round(budget * 0.7), limit_paise: budget },
});

export const RAVI: ContactCard = { name: "Ravi", phone: "+919800000202" };
export const PRIYA: ContactCard = { name: "Priya", phone: "+919800000101", address: "Flat 302, 3rd floor, 5th Cross" };
