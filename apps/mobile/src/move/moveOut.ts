import { type MoveOffer, offerMove, type Ports } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { type Account, keepProfile } from "../adapters/account.js";
import { newPhoneClient } from "../adapters/newPhone.js";
import { qrDataUrl } from "../payments/qr.js";
import { pauseSync } from "./pause.js";

/** What the old phone shows while it waits: the QR picture and what went into it. */
export interface ShownMove extends MoveOffer {
  image: string;
}

/**
 * The old phone's half of a move: the mailbox is checked once more (`sync`, which also sends what is queued), then
 * left alone, the owner's part of the account is kept among their records so it travels with them, and the records
 * are sealed and uploaded. The QR picture carries the key; it is drawn here and never leaves the phone.
 */
export async function showMoveCode(
  ports: Ports,
  account: Account,
  lang: Lang,
  sync: () => Promise<unknown>,
): Promise<ShownMove> {
  await sync().catch(() => undefined);
  pauseSync(true);
  try {
    await keepProfile(ports.storage, account);
    const offer = await offerMove(ports.storage, newPhoneClient(account.session), {
      owner: account.session.user,
      lang,
      now: ports.clock.now(),
    });
    return { ...offer, image: await qrDataUrl(offer.text) };
  } catch (err) {
    pauseSync(false);
    throw err;
  }
}

/** Whether the new phone has taken over: this device was signed out by it. Unanswered checks count as not yet. */
export async function movedAway(account: Account): Promise<boolean> {
  try {
    return !(await newPhoneClient(account.session).stillSignedIn());
  } catch {
    return false;
  }
}
