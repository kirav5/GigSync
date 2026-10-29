import { type DevicePublicKeys, newDeviceSecrets, verify } from "@gigsync/crypto";
import {
  type ContactCard,
  type DeviceId,
  type DeviceKeys,
  type Envelope,
  type Lang,
  type MessageId,
  type Payee,
  type RateCard,
  SEED_SIGNER,
  signingBytes,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import {
  GigDevice,
  HttpError,
  MemoryStorage,
  type Model,
  type NewNeed,
  type Relay,
  SecretKeys,
  SystemClock,
  savePayee,
  type WorkerRules,
} from "../src/index.js";

/** The mailbox and directory in memory, checking signatures as workers/api does. */
export class MemoryRelay {
  private readonly devices = new Map<UserId, DeviceKeys[]>();
  private readonly boxes = new Map<DeviceId, Envelope[]>();
  /** Every envelope the relay accepted, as the server would store it. */
  readonly stored: Envelope[] = [];

  /** `protocol` is the capability number the device reports at sign-in. */
  register(user: UserId, device: DeviceId, keys: DevicePublicKeys, protocol = 1) {
    this.devices.set(user, [...(this.devices.get(user) ?? []), { device_id: device, protocol, ...keys }]);
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
  /** The phone's own storage, for checking what it keeps (its agent's memory, say). */
  storage: MemoryStorage;
}

/** One phone. `payee` is the UPI ID saved in its settings, as the owner would in Profile. */
export async function phone(
  relay: MemoryRelay,
  contact: ContactCard,
  opts: {
    worker?: WorkerRules;
    autoConfirm?: boolean;
    lang?: Lang;
    payee?: Payee;
    model?: Model;
    /** The capability number this phone registers; 1 unless a test needs a newer phone. */
    protocol?: number;
  } = {},
): Promise<Phone> {
  const { payee, protocol, ...options } = opts;
  const keys = new SecretKeys(newDeviceSecrets());
  const me = { user: `usr_${ulid()}` as UserId, device: `dev_${ulid()}` as DeviceId };
  relay.register(me.user, me.device, await keys.publicKeys(), protocol);
  const storage = new MemoryStorage();
  if (payee) await savePayee(storage, payee);
  const device = new GigDevice({
    relay: relay.for(me),
    storage,
    keys,
    clock: new SystemClock(),
    me,
    contact,
    ...options,
  });
  return { user: me.user, device, storage };
}

export const BENGALURU = { lat: 12.97, lon: 77.64 };

export function electrician(min = 55000, rate = 70000): WorkerRules {
  return {
    trades: ["electrician"],
    rate: { opening_paise: rate, limit_paise: min },
    base: BENGALURU,
    radius_km: 10,
  };
}

/** The UPI ID Ravi saved in Profile. */
export const RAVI_PAYEE: Payee = { vpa: "ravi.test@okaxis", name: "Ravi Electricals" };

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

/** Asha, a cook in Koramangala: her floor is ₹8,000 a month, her usual rate ₹9,500. */
export function cook(min = 800000, rate = 950000): WorkerRules {
  return {
    trades: ["cook"],
    rate: { opening_paise: rate, limit_paise: min },
    base: BENGALURU,
    radius_km: 5,
  };
}

/** Ravi's household needs a cook, mornings, and has said nothing else yet. */
export const cookNeed = (budget = 900000, details: Record<string, string> = {}): NewNeed => ({
  trade: "cook",
  need: "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು",
  when: "mon–sat 07:00–10:00",
  area: { lat: 12.975, lon: 77.645 },
  details,
  budget: { opening_paise: 700000, limit_paise: budget },
});

export const ASHA: ContactCard = { name: "Asha", phone: "+919800000303" };
export const RAVI_HOME: ContactCard = { name: "Ravi", phone: "+919800000404", address: "12, 4th Block, Koramangala" };

/** Bengaluru's cook band as the union's rate card might seed it: ₹7,500–9,500 a month, +15% with pets, +10% a person past 3. */
export const BENGALURU_RATES: RateCard = {
  city: "Bengaluru",
  version: 1,
  signed_by: SEED_SIGNER,
  bands: [
    {
      trade: "cook",
      low_paise: 750000,
      high_paise: 950000,
      scope: [
        { kind: "flag", key: "pets", percent: 15 },
        { kind: "count", key: "people", percent: 10, included: 3 },
      ],
    },
  ],
};
