import {
  ApiClient,
  Collection,
  claimLegacyRecords,
  GigDevice,
  loadPayee,
  log,
  ownerPorts,
  PayeeError,
  type Ports,
  savePayee,
  type WorkerRules,
} from "@gigsync/core";
import {
  type ColleagueCard,
  type ContactCard,
  type Lang,
  MAX_TRADES,
  MENTOR_PROTOCOL,
  PAYEE_NAME_MAX,
  type Session,
  type UserId,
  Vpa,
} from "@gigsync/protocol";
import { areaKeyOf, PILOT_CITY } from "../ui/places.js";
import { API_BASE } from "./api.js";

/** Which side of a job this phone's owner is on. One account, one role, in this first version. */
export const AccountRole = { consumer: "consumer", worker: "worker" } as const;
export type AccountRole = (typeof AccountRole)[keyof typeof AccountRole];

/** Who is signed in on this phone. Kept only here; the server knows the session token and public keys. */
export interface Account {
  session: Session;
  role: AccountRole;
  /** Released to the other party only after both sign a job. */
  contact: ContactCard;
  /** A worker's private rules: trades, area, rates. Set when they publish their card. The UPI ID is not here. */
  worker?: WorkerRules;
  /** Sign deals the agent reaches without asking first. Off unless the owner turns it on. */
  autoConfirm?: boolean;
  /** The languages a worker listed on their card, their own first. */
  languages?: Lang[];
  /** The line about their work on the worker's card, kept here so publishing again does not wipe it. */
  about?: string;
  /** False once the worker takes their card off the board; absent or true while it is listed. */
  listed?: boolean;
  /** The protocol the directory has for this device; absent on accounts signed in before it was kept. */
  protocol?: number;
}

const ACCOUNT_KEY = "account";
/** The owner's settings record holding their part of the account while they are signed out. */
const PROFILE_KEY = "profile";

/** What of an account is the owner's own, not the session's: their role, card rules and choices. */
type Profile = Omit<Account, "session" | "contact" | "protocol">;
/**
 * What this app understands, sent with the device's keys at sign-in: notes on a link, questions a worker's agent's
 * model wrote, and the mentor envelopes. Each capability number includes the ones before it (COLLEAGUE_PROTOCOL is 2,
 * FREE_QUESTIONS_PROTOCOL 3). An older phone may still send this one an in-person link ask or a referral, which the
 * colleague number promised; both are dropped on arrival.
 */
const PROTOCOL = MENTOR_PROTOCOL;

export class AccountError extends Error {}

export function apiClient(session?: Session): ApiClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  const api = new ApiClient(API_BASE);
  return session ? api.as(session) : api;
}

/** Who is signed in on this phone, with the phone's records from before owners were kept apart made theirs. */
export async function loadAccount(ports: Ports): Promise<Account | undefined> {
  const account = await ports.storage.get<Account>(Collection.settings, ACCOUNT_KEY);
  if (!account) return undefined;
  await claimLegacyRecords(ports.storage, account.session.user, ports.clock.now());
  return moveLegacyVpa(ownerPorts(ports, account.session.user), account);
}

/** A card published before the UPI ID moved to settings kept it, and the name payers see, in the worker's rules. */
type LegacyRules = WorkerRules & { vpa?: string; payee_name?: string };

/**
 * One time: copies a legacy card's UPI ID into the payee store, the one place payment requests and the QR read it,
 * unless one is saved there already, then drops it from the rules. A UPI ID that was never valid is dropped too: it
 * could not have been paid to. If the copy fails, the account is left as it was, to try again next time.
 */
async function moveLegacyVpa(ports: Ports, account: Account): Promise<Account> {
  const rules = account.worker as LegacyRules | undefined;
  if (account.role !== AccountRole.worker || !rules || (rules.vpa === undefined && rules.payee_name === undefined))
    return account;
  const { vpa, payee_name: _name, ...worker } = rules;
  if (vpa !== undefined && Vpa.safeParse(vpa).success && !(await loadPayee(ports.storage))) {
    try {
      await savePayee(ports.storage, { vpa, name: account.contact.name.slice(0, PAYEE_NAME_MAX) });
    } catch (err) {
      if (!(err instanceof PayeeError)) throw err;
      log.warn("legacy UPI ID not moved", { problem: err.problem });
      return account;
    }
  }
  const moved: Account = { ...account, worker };
  await saveAccount(ports, moved);
  return moved;
}

export function saveAccount(ports: Ports, account: Account): Promise<void> {
  return ports.storage.put(Collection.settings, ACCOUNT_KEY, account);
}

/**
 * Forgets who is signed in, and nothing else: their jobs, money, memory, UPI ID, mentors and their card's rules stay
 * on the phone under their name (owner storage, in core), out of sight of whoever signs in next, and back when they
 * sign in again. The rules are kept first, so a failure leaves the owner signed in with nothing lost.
 */
export async function signOut(ports: Ports): Promise<void> {
  const account = await ports.storage.get<Account>(Collection.settings, ACCOUNT_KEY);
  if (account) {
    const { session, contact: _contact, protocol: _protocol, ...profile } = account;
    await ownerPorts(ports, session.user).storage.put<Profile>(Collection.ownerSettings, PROFILE_KEY, profile);
  }
  await ports.storage.delete(Collection.settings, ACCOUNT_KEY);
}

export async function sendCode(phone: string): Promise<void> {
  await apiClient().requestOtp(phone);
}

/**
 * Verifies the code and registers this device's public keys; the private keys never leave the phone. Someone signing
 * back in gets their card's rules and choices again, when they sign in with the role they had.
 */
export async function signIn(
  ports: Ports,
  input: { phone: string; code: string; role: AccountRole; contact: ContactCard },
): Promise<Account> {
  const keys = await ports.keys.publicKeys();
  const session = await apiClient().verifyOtp(input.phone, input.code, { ...keys, protocol: PROTOCOL });
  await claimLegacyRecords(ports.storage, session.user, ports.clock.now());
  const kept = await ownerPorts(ports, session.user).storage.get<Profile>(Collection.ownerSettings, PROFILE_KEY);
  const account: Account = {
    ...(kept?.role === input.role ? kept : {}),
    session,
    role: input.role,
    contact: input.contact,
    protocol: PROTOCOL,
  };
  await saveAccount(ports, account);
  return account;
}

/**
 * After an app update, tells the directory this device speaks the newer protocol, so other phones send it the newer
 * kinds (model questions, mentors) without the owner signing in again. Offline or failed: tried again next launch.
 */
export async function raiseDeviceProtocol(ports: Ports, account: Account): Promise<void> {
  if ((account.protocol ?? 0) >= PROTOCOL) return;
  try {
    await apiClient(account.session).raiseProtocol(PROTOCOL);
    await saveAccount(ports, { ...account, protocol: PROTOCOL });
  } catch (err) {
    log.warn("device protocol not raised", { error: err instanceof Error ? err.name : String(err) });
  }
}

/**
 * This phone's agent for jobs, acting as the signed-in owner, tagging their free text with the phone's language.
 * `ports` are the owner's (`ownerPorts`), so the agent keeps its jobs, mail and money under their name.
 */
export function deviceFor(ports: Ports, account: Account, lang: Lang): GigDevice {
  const api = apiClient(account.session);
  return new GigDevice({
    relay: api,
    mentorApi: api,
    storage: ports.storage,
    keys: ports.keys,
    clock: ports.clock,
    me: { user: account.session.user, device: account.session.device },
    contact: account.contact,
    ...(account.worker ? { worker: account.worker } : {}),
    ...(account.autoConfirm ? { autoConfirm: true } : {}),
    model: ports.model,
    estimates: { api, city: PILOT_CITY, areaKey: areaKeyOf },
    lang,
  });
}

export function rememberName(ports: Ports, user: UserId, name: string): Promise<void> {
  return ports.storage.put(Collection.people, user, { name });
}

export async function nameOf(ports: Ports, user: UserId): Promise<string | undefined> {
  return (await ports.storage.get<{ name: string }>(Collection.people, user))?.name;
}

/**
 * What another worker sees of this one on a landing request, a mentor's offer or an introduction: their contact
 * card's name, their card's trades, the languages they speak.
 */
export function personCard(account: Account, lang: Lang): ColleagueCard {
  return {
    name: account.contact.name,
    trades: (account.worker?.trades ?? []).slice(0, MAX_TRADES),
    languages: [...new Set(account.languages ?? [lang])],
  };
}
