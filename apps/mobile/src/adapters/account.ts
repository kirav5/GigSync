import {
  ApiClient,
  Collection,
  claimLegacyRecords,
  GigDevice,
  loadPayee,
  log,
  type MovedRecords,
  ownerPorts,
  PayeeError,
  type Ports,
  type Storage,
  savePayee,
  type WorkerRules,
} from "@gigsync/core";
import {
  type ColleagueCard,
  type ContactCard,
  type Lang,
  MAX_TRADES,
  PAYEE_NAME_MAX,
  RECOMMEND_PROTOCOL,
  type Session,
  type UserId,
  Vpa,
} from "@gigsync/protocol";
import { API_BASE } from "./api.js";
import { cityOf } from "./cities.js";
import { cryptoRandom } from "./random.js";
import { recordsClient } from "./records.js";
import { watchedFetch } from "./session-end.js";

/** Which side of a job this phone's owner is on. One account, one role, in this first version. */
export const AccountRole = { consumer: "consumer", worker: "worker" } as const;
export type AccountRole = (typeof AccountRole)[keyof typeof AccountRole];

/** Who is signed in on this phone. Kept only here; the server knows the session token and public keys. */
export interface Account {
  session: Session;
  role: AccountRole;
  /**
   * Released to the other party only after both sign a job. Its name is the one everyone sees: the name typed at sign-in
   * until the owner passes the ID check, then the name on their Aadhaar (`takeCardName`).
   */
  contact: ContactCard;
  /** The name typed at sign-in, once the Aadhaar's replaced it: shown to the owner alone, never sent anywhere. */
  nickname?: string;
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
/** The phone's settings record holding the number whose session the server stopped taking, for sign-in to open on. */
const SIGN_IN_AGAIN_KEY = "sign_in_again";

/**
 * What of an account is the owner's own, not the session's: their role, card rules and choices, and the name they gave
 * once, so signing back in on this phone never asks it again (and never lets a sign-in change it).
 */
export type Profile = Omit<Account, "session" | "contact" | "protocol"> & { name?: string };
/**
 * What this app understands, sent with the device's keys at sign-in: notes on a link, questions a worker's agent's
 * model wrote, the mentor envelopes, terms besides the price in offers and signed deals, offers to work from a personal
 * QR, a problem reported on a job, the owners' own offers after their agents', a start hour in a job's time
 * (ADR 0053 §1), part payments, and being told a household recommended you (ADR 0055). Each capability number includes
 * the ones before it (COLLEAGUE_PROTOCOL is 2, FREE_QUESTIONS_PROTOCOL 3, MENTOR_PROTOCOL 4, TERMS_PROTOCOL 5,
 * WORK_OFFER_PROTOCOL 6, PROBLEM_PROTOCOL 7, OWNER_OFFERS_PROTOCOL 8, HOURS_PROTOCOL 9, PART_PAYMENTS_PROTOCOL 10). An older
 * phone may still send this one an in-person link ask or a referral, which the colleague number promised; both are dropped on arrival.
 */
export const PROTOCOL = RECOMMEND_PROTOCOL;

export class AccountError extends Error {}

export function apiClient(session?: Session): ApiClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  // Signed-in calls watch for a session the server no longer takes; sign-in itself has none to lose.
  return session ? new ApiClient(API_BASE, watchedFetch, session) : new ApiClient(API_BASE);
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
  // The server stops sealing to this phone. Offline, sign-out still happens here; the next sign-in reuses the row.
  // Not watched for a refused session: one already gone is no reason to say "Sign in again" after a sign-out.
  if (account)
    await apiClient()
      .as(account.session)
      .signOut()
      .catch((err: unknown) => log.warn("sign-out not sent", { error: err instanceof Error ? err.name : typeof err }));
  if (account) await keepProfile(ownerPorts(ports, account.session.user).storage, account);
  await ports.storage.delete(Collection.settings, ACCOUNT_KEY);
}

/**
 * A session the server no longer takes (it expired, the device was retired, or the server lost it): the account goes as
 * at sign-out, its owner's part kept, and the number is remembered so sign-in opens on it with "Sign in again". Nothing
 * is sent: the server has refused the session already.
 */
export async function endSession(ports: Ports): Promise<void> {
  const account = await ports.storage.get<Account>(Collection.settings, ACCOUNT_KEY);
  if (!account) return;
  await keepProfile(ownerPorts(ports, account.session.user).storage, account);
  await ports.storage.put<SignInAgain>(Collection.settings, SIGN_IN_AGAIN_KEY, { phone: account.contact.phone });
  await ports.storage.delete(Collection.settings, ACCOUNT_KEY);
}

interface SignInAgain {
  phone: string;
}

/** The number whose session ended on this phone, until someone signs in again. */
export async function signInAgainNumber(ports: Ports): Promise<string | undefined> {
  return (await ports.storage.get<SignInAgain>(Collection.settings, SIGN_IN_AGAIN_KEY))?.phone;
}

export function forgetSignInAgain(ports: Ports): Promise<void> {
  return ports.storage.delete(Collection.settings, SIGN_IN_AGAIN_KEY);
}

/** The owner's kept part of the account on this phone, read under their name. */
export function keptProfile(owned: Storage): Promise<Profile | undefined> {
  return owned.get<Profile>(Collection.ownerSettings, PROFILE_KEY);
}

/**
 * Keeps the owner's part of the account (role, card rules, choices) among their own records, where signing back in
 * finds it, and where a move to a new phone takes it. `owned` is the owner's view of the phone's storage.
 */
export function keepProfile(owned: Storage, account: Account): Promise<void> {
  const { session: _session, contact, protocol: _protocol, ...profile } = account;
  return owned.put<Profile>(Collection.ownerSettings, PROFILE_KEY, { ...profile, name: contact.name });
}

/** The account with the owner's kept part, as a move to this phone brought it, when it is for the same role. */
export async function withKeptProfile(owned: Storage, account: Account): Promise<Account> {
  const kept = await keptProfile(owned);
  if (kept?.role !== account.role) return account;
  const { name: _name, ...rules } = kept;
  const { session, contact, protocol } = account;
  return { ...rules, session, contact, ...(protocol === undefined ? {} : { protocol }) };
}

/** The role of the account a move package came from, when it carries the owner's kept part. */
export function movedRole(records: MovedRecords): AccountRole | undefined {
  const kept = records[Collection.ownerSettings]?.find((r) => r.id === PROFILE_KEY)?.value;
  if (typeof kept !== "object" || kept === null || !("role" in kept)) return undefined;
  return Object.values(AccountRole).find((role) => role === kept.role);
}

/**
 * After a passed ID check: the Aadhaar's name becomes the name on the card, the QR, chats and jobs, so nobody sees a
 * name the card does not carry. The name typed at sign-in stays, on this phone only, as the owner's nickname.
 */
export async function takeCardName(ports: Ports, account: Account, cardName: string): Promise<Account> {
  if (account.contact.name === cardName) return account;
  const nickname = account.nickname ?? account.contact.name;
  const named: Account = { ...account, nickname, contact: { ...account.contact, name: cardName } };
  await saveAccount(ports, named);
  return named;
}

/**
 * After an app update, tells the directory this device speaks the newer protocol, so other phones send it the newer
 * kinds (model questions, mentors, offers to work) without the owner signing in again. Offline or failed: tried again next launch.
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
    random: cryptoRandom,
    me: { user: account.session.user, device: account.session.device },
    contact: account.contact,
    ...(account.worker ? { worker: account.worker } : {}),
    ...(account.autoConfirm ? { autoConfirm: true } : {}),
    model: ports.model,
    estimates: { api, cityOf },
    qrApi: api,
    records: recordsClient(account.session),
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
