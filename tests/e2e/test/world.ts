import {
  ApiClient,
  GigDevice,
  Header,
  MemoryStorage,
  type NewNeed,
  type Random,
  SecretKeys,
  SystemClock,
  savePayee,
  settle,
  type WorkerRules,
} from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import type { ContactCard, Lang, Payee, Place, Session, Trade } from "@gigsync/protocol";

/** The API under test: `pnpm dev:workers`, which talks to the Neon directory. */
export const API = process.env.API_BASE ?? "http://localhost:8787";
const DEV_OTP = process.env.DEV_OTP ?? "000000";
const KM_PER_DEGREE = 111;
const IP_OCTET = 250;

const UINT32 = 2 ** 32;
/** Each job's hidden negotiation settings come from the platform's cryptographic source, as on a phone. */
const cryptoRandom: Random = { next: () => (crypto.getRandomValues(new Uint32Array(1))[0] as number) / UINT32 };

/** A fresh 10-digit Indian mobile number, so runs never collide in the shared directory. */
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
export const newPhone = () => `+9198${digits(8)}`;

/**
 * A random spot in peninsular India for this run, so workers listed by earlier runs (or other test files) are never
 * inside its search radius.
 */
export function newCentre(): Place {
  return { lat: 10 + Math.random() * 15, lon: 75 + Math.random() * 10 };
}

/** A point `north` and `east` kilometres from `c`. */
export function near(c: Place, north: number, east = 0): Place {
  return {
    lat: c.lat + north / KM_PER_DEGREE,
    lon: c.lon + east / (KM_PER_DEGREE * Math.cos((c.lat * Math.PI) / 180)),
  };
}

/** Locally, wrangler takes the client IP from this header, so each simulated phone is its own client. */
const randomIp = () =>
  `10.${Math.floor(Math.random() * IP_OCTET)}.${Math.floor(Math.random() * IP_OCTET)}.${Math.floor(Math.random() * IP_OCTET)}`;
function client(): ApiClient {
  const ip = randomIp();
  return new ApiClient(API, (input, init) =>
    fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), [Header.cfConnectingIp]: ip } }),
  );
}

/** One person with their own phone: keys, storage, a session, and the agent. */
export interface Person {
  name: string;
  contact: ContactCard;
  session: Session;
  /** Calls as this person, for the board and for looking at the raw mailbox. */
  api: ApiClient;
  /** Their device keys, for tests that build envelopes by hand. */
  keys: SecretKeys;
  device: GigDevice;
}

/** One person's phone. `payee` is the UPI ID they saved in Profile, kept in that phone's settings. */
export async function person(
  name: string,
  opts: { worker?: WorkerRules; autoConfirm?: boolean; address?: string; lang?: Lang; payee?: Payee } = {},
): Promise<Person> {
  const keys = new SecretKeys(newDeviceSecrets());
  const phone = newPhone();
  const anon = client();
  const session = await anon.verifyOtp(phone, DEV_OTP, { ...(await keys.publicKeys()), protocol: 1 });
  const api = anon.as(session);
  const contact: ContactCard = { name, phone, ...(opts.address ? { address: opts.address } : {}) };
  const storage = new MemoryStorage();
  if (opts.payee) await savePayee(storage, opts.payee);
  const device = new GigDevice({
    relay: api,
    storage,
    keys,
    clock: new SystemClock(),
    random: cryptoRandom,
    me: { user: session.user, device: session.device },
    contact,
    ...(opts.worker ? { worker: opts.worker } : {}),
    ...(opts.autoConfirm !== undefined ? { autoConfirm: opts.autoConfirm } : {}),
    ...(opts.lang ? { lang: opts.lang } : {}),
  });
  return { name, contact, session, api, keys, device };
}

/** A test UPI ID for someone, as they would save it in Profile: `<name>.test@okaxis`. */
export function testPayee(name: string): Payee {
  return { vpa: `${name.toLowerCase().replace(/[^a-z]/g, "")}.test@okaxis`, name };
}

/**
 * A worker who has listed themselves on the board: public rate = opening, private minimum = limit. Their UPI ID is
 * saved in settings, as `testPayee` makes it.
 */
export async function worker(
  name: string,
  trades: Trade[],
  where: Place,
  price: { rate: number; min: number },
  opts: { autoConfirm?: boolean; radiusKm?: number; areaName?: string } = {},
): Promise<Person> {
  const rules: WorkerRules = {
    trades,
    rate: { opening_paise: price.rate, limit_paise: price.min },
    base: where,
    radius_km: opts.radiusKm ?? 10,
  };
  const p = await person(name, {
    worker: rules,
    payee: testPayee(name),
    ...(opts.autoConfirm !== undefined ? { autoConfirm: opts.autoConfirm } : {}),
  });
  await p.api.publishProfile({
    display_name: name,
    trades,
    area: where,
    area_name: opts.areaName ?? "Test town",
    rate_paise: price.rate,
    languages: ["hi", "en"],
    about: `${trades.join(", ")} for 10 years`,
  });
  return p;
}

/** Lets the given people's phones talk until nothing moves. */
export function talk(...people: Person[]): Promise<number> {
  return settle(people.map((p) => p.device));
}

/** A consumer's need near `where`, with a private budget: opening at 70% of it. */
export function need(
  trade: Trade,
  where: Place,
  budget: number,
  text: string,
  details: Record<string, string> = {},
): NewNeed {
  return {
    trade,
    need: text,
    when: "tomorrow 10:00",
    area: where,
    details,
    budget: { opening_paise: Math.round(budget * 0.7), limit_paise: budget },
  };
}
