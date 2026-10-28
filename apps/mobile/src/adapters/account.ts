import { ApiClient, Collection, GigDevice, type Ports, type WorkerRules } from "@gigsync/core";
import type { ContactCard, Lang, Session, UserId } from "@gigsync/protocol";
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
  /** A worker's private rules: trades, area, minimum rate, UPI ID. Set when they publish their card. */
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
/** The protocol's version this app speaks, sent with the device's keys at sign-in. */
const PROTOCOL = 1;

export class AccountError extends Error {}

export function apiClient(session?: Session): ApiClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  const api = new ApiClient(API_BASE);
  return session ? api.as(session) : api;
}

export function loadAccount(ports: Ports): Promise<Account | undefined> {
  return ports.storage.get<Account>(Collection.settings, ACCOUNT_KEY);
}

export function saveAccount(ports: Ports, account: Account): Promise<void> {
  return ports.storage.put(Collection.settings, ACCOUNT_KEY, account);
}

export function signOut(ports: Ports): Promise<void> {
  return ports.storage.delete(Collection.settings, ACCOUNT_KEY);
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
    lang,
  });
}

export function rememberName(ports: Ports, user: UserId, name: string): Promise<void> {
  return ports.storage.put(PEOPLE, user, { name });
}

export async function nameOf(ports: Ports, user: UserId): Promise<string | undefined> {
  return (await ports.storage.get<{ name: string }>(PEOPLE, user))?.name;
}
