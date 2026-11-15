import { claimLegacyRecords, ownerPorts, type Ports } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { type Account, type AccountRole, keptProfile, PROTOCOL, type Profile, saveAccount } from "./account.js";
import { sendPhoneCode, verifyPhoneCode } from "./phoneCode.js";

/**
 * Sign-in in the order the owner meets it: the number, its code, then, only for a number this phone keeps nothing
 * for, find work or find help and the name. The code is checked before the side is asked, so a returning number goes
 * straight in with the side and name it had, and a sign-in never changes either.
 */

/** A number just verified on this phone: its new session, and the owner's part this phone kept for it, if any. */
export interface Verified {
  session: Session;
  /** The number the code went to, as the server takes it. */
  phone: string;
  kept?: Profile;
}

export async function sendCode(phone: string): Promise<void> {
  await sendPhoneCode(phone);
}

/**
 * Verifies the code and registers this device's public keys; the private keys never leave the phone. Nothing is saved
 * yet: closing the app before the account is made signs nobody in.
 */
export async function verifyNumber(ports: Ports, input: { phone: string; code: string }): Promise<Verified> {
  const keys = await ports.keys.publicKeys();
  const session = await verifyPhoneCode(input.phone, input.code, { ...keys, protocol: PROTOCOL });
  await claimLegacyRecords(ports.storage, session.user, ports.clock.now());
  const kept = await keptProfile(ownerPorts(ports, session.user).storage);
  return { session, phone: input.phone, ...(kept ? { kept } : {}) };
}

/**
 * The account for a verified number in the side it is on: the one this phone kept for it when there is one (so no
 * question is asked), otherwise `role`, the side just chosen. The number on it is always the one just verified.
 * Undefined while this phone keeps nothing for the number and no side is chosen yet.
 */
export function accountFor(verified: Verified, role?: AccountRole): Account | undefined {
  const { session, phone, kept } = verified;
  const side = kept?.role ?? role;
  if (!side) return undefined;
  const { name = "", ...rules } = kept ?? {};
  return { ...(kept?.role === side ? rules : {}), session, role: side, contact: { name, phone }, protocol: PROTOCOL };
}

/** True for an account signed in with a number this phone has no name for yet. */
export const needsName = (account: Account): boolean => !account.contact.name;

/** Saves a signed-in account, with its name when it was just given: from here on the phone is signed in. */
export async function saveSignedIn(ports: Ports, account: Account, name?: string): Promise<Account> {
  const named: Account = name ? { ...account, contact: { ...account.contact, name } } : account;
  await saveAccount(ports, named);
  return named;
}
