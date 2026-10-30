import {
  applyMerge,
  type MergeChoice,
  type MergePlan,
  MoveError,
  MoveProblem,
  type OpenedMove,
  openMove,
  type Ports,
  planMerge,
  revokeOldPhone,
} from "@gigsync/core";
import type { DeviceId, Lang } from "@gigsync/protocol";
import { type Account, keepProfile, movedRole, saveAccount, withKeptProfile } from "../adapters/account.js";
import { newPhoneClient } from "../adapters/newPhone.js";

/** The old phone's records, opened here, and how they meet this phone's. Nothing is written yet. */
export interface OpenedHere {
  opened: OpenedMove;
  plan: MergePlan;
}

/**
 * The new phone's first half: downloads and opens what the scanned code points to, checks it is this owner's and the
 * same role, and compares it with what this phone has. This phone's own card rules (unless they only came back from
 * the board, without the lowest price) are kept among the owner's records first, so a card that differs on the two
 * phones is asked about too. Throws MoveError.
 */
export async function openMoveCode(ports: Ports, account: Account, text: string): Promise<OpenedHere> {
  const { user, device } = account.session;
  const opened = await openMove(newPhoneClient(account.session), { owner: user, device, text });
  const role = movedRole(opened.package.records);
  if (role !== undefined && role !== account.role) throw new MoveError(MoveProblem.other_role);
  if (account.worker && !account.worker.floor_missing) await keepProfile(ports.storage, account);
  return { opened, plan: await planMerge(ports.storage, opened.package.records) };
}

/** What the move left this phone with: the account as the old phone had it, its language, what stayed behind. */
export interface MovedIn {
  account: Account;
  lang?: Lang;
  left_out: string[];
  from: DeviceId;
}

/** Writes the old phone's records as the owner chose, and takes the account's card rules and choices from them. */
export async function keepMovedRecords(
  ports: Ports,
  account: Account,
  here: OpenedHere,
  choice: MergeChoice,
): Promise<MovedIn> {
  await applyMerge(ports.storage, here.plan, choice);
  const next = await withKeptProfile(ports.storage, account);
  await saveAccount(ports, next);
  const { lang, left_out } = here.opened.package;
  return { account: next, left_out, from: here.opened.from, ...(lang ? { lang } : {}) };
}

/** Signs the old phone out for good, once its records are written here. Safe to retry. */
export function signOutOldPhone(account: Account, from: DeviceId): Promise<void> {
  return revokeOldPhone(newPhoneClient(account.session), from);
}
