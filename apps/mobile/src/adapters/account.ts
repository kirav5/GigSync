import {
  ApiClient,
  Collection,
  forgetPayee,
  GigDevice,
  loadPayee,
  log,
  PayeeError,
  type Ports,
  savePayee,
  type WorkerRules,
} from "@gigsync/core";
import {
  type ColleagueCard,
  ContactCard,
  type EngagementId,
  FREE_QUESTIONS_PROTOCOL,
  type Lang,
  MAX_TRADES,
  PAYEE_NAME_MAX,
  type Session,
  type UserId,
  Vpa,
} from "@gigsync/protocol";
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
}

const ACCOUNT_KEY = "account";
/** Names the consumer saw on the board, so their jobs show who they are talking to. */
const PEOPLE = "people";
/**
 * What this app understands, sent with the device's keys at sign-in: colleague and referral envelopes, and questions
 * a worker's agent's model wrote. Each capability number includes the ones before it (COLLEAGUE_PROTOCOL is 2).
 */
const PROTOCOL = FREE_QUESTIONS_PROTOCOL;

export class AccountError extends Error {}

export function apiClient(session?: Session): ApiClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  const api = new ApiClient(API_BASE);
  return session ? api.as(session) : api;
}

export async function loadAccount(ports: Ports): Promise<Account | undefined> {
  const account = await ports.storage.get<Account>(Collection.settings, ACCOUNT_KEY);
  return account ? moveLegacyVpa(ports, account) : undefined;
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
 * Forgets who is signed in, and their UPI ID with them: phones are shared, and the next worker to sign in here must
 * never have customers pay the one who left. The UPI ID goes first, so a failure leaves the owner still signed in
 * rather than leaving their UPI ID to a stranger.
 */
export async function signOut(ports: Ports): Promise<void> {
  await forgetPayee(ports.storage);
  await ports.storage.delete(Collection.settings, ACCOUNT_KEY);
}

export async function sendCode(phone: string): Promise<void> {
  await apiClient().requestOtp(phone);
}

/** Verifies the code and registers this device's public keys; the private keys never leave the phone. */
export async function signIn(
  ports: Ports,
  input: { phone: string; code: string; role: AccountRole; contact: ContactCard },
): Promise<Account> {
  const keys = await ports.keys.publicKeys();
  const session = await apiClient().verifyOtp(input.phone, input.code, { ...keys, protocol: PROTOCOL });
  const account: Account = { session, role: input.role, contact: input.contact };
  await saveAccount(ports, account);
  return account;
}

/** This phone's agent for jobs, acting as the signed-in owner, tagging their free text with the phone's language. */
export function deviceFor(ports: Ports, account: Account, lang: Lang): GigDevice {
  return new GigDevice({
    relay: apiClient(account.session),
    storage: ports.storage,
    keys: ports.keys,
    clock: ports.clock,
    me: { user: account.session.user, device: account.session.device },
    contact: account.contact,
    ...(account.worker ? { worker: account.worker } : {}),
    ...(account.autoConfirm ? { autoConfirm: true } : {}),
    model: ports.model,
    lang,
  });
}

export function rememberName(ports: Ports, user: UserId, name: string): Promise<void> {
  return ports.storage.put(PEOPLE, user, { name });
}

export async function nameOf(ports: Ports, user: UserId): Promise<string | undefined> {
  return (await ports.storage.get<{ name: string }>(PEOPLE, user))?.name;
}

/**
 * Saves where a worker's own work is, as the address on their contact card: a helper they hire gets it once both sign
 * (round2-spec §3.3 A). Empty takes it off the card. Throws AccountError when the card would not be valid.
 */
export async function saveSite(ports: Ports, account: Account, address: string): Promise<Account> {
  const { address: _old, ...rest } = account.contact;
  const contact = ContactCard.safeParse(address ? { ...rest, address } : rest);
  if (!contact.success) throw new AccountError("Work site address not valid");
  const next: Account = { ...account, contact: contact.data };
  await saveAccount(ports, next);
  return next;
}

/** What a colleague sees of this worker: their contact card's name, their card's trades, the languages they speak. */
export function colleagueCard(account: Account, lang: Lang): ColleagueCard {
  return {
    name: account.contact.name,
    trades: (account.worker?.trades ?? []).slice(0, MAX_TRADES),
    languages: [...new Set(account.languages ?? [lang])],
  };
}

/** What the owner said to a colleague suggestion on a declined job: asked the colleague, or no thanks. */
export const ReferralAnswer = { asked: "asked", no: "no" } as const;
export type ReferralAnswer = (typeof ReferralAnswer)[keyof typeof ReferralAnswer];

/** Answers to colleague suggestions, by job, so an answered one leaves To decide on either phone. */
const REFERRAL_ANSWERS = "referral_answers";

export function answerReferral(ports: Ports, job: EngagementId, answer: ReferralAnswer): Promise<void> {
  return ports.storage.put(REFERRAL_ANSWERS, job, { job, answer });
}

export async function referralAnswers(ports: Ports): Promise<Map<EngagementId, ReferralAnswer>> {
  const rows = await ports.storage.list<{ job: EngagementId; answer: ReferralAnswer }>(REFERRAL_ANSWERS);
  return new Map(rows.map((r) => [r.job, r.answer]));
}
