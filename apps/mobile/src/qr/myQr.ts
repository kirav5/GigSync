import { qrOwner } from "@gigsync/core";
import { type MyQr, QrRole } from "@gigsync/protocol";
import { type Account, AccountRole, apiClient } from "../adapters/account.js";
import { myQrLink } from "../adapters/links.js";
import { qrDataUrl } from "../payments/qr.js";

/** The owner's QR as the screen shows it: the link it carries and the picture of it. */
export interface ShownQr {
  link: string;
  image: string;
}

/** What the owner's QR shows: their role and first name. A worker's card comes from the board. */
const ownerOf = (account: Account) =>
  qrOwner(account.contact.name, account.role === AccountRole.worker ? QrRole.enum.worker : QrRole.enum.household);

async function shown(mine: MyQr): Promise<ShownQr> {
  const link = myQrLink(mine.code);
  return { link, image: await qrDataUrl(link) };
}

/** The owner's live QR, made by the server on first ask, drawn on this phone. */
export async function loadMyQr(account: Account): Promise<ShownQr> {
  return shown(await apiClient(account.session).myQr(ownerOf(account)));
}

/** A new QR in place of the old one, which stops finding the owner at once. */
export async function replaceMyQr(account: Account): Promise<ShownQr> {
  return shown(await apiClient(account.session).replaceQr(ownerOf(account)));
}

/** The name a downloaded QR picture is saved under. */
export const QR_FILE = "gigsync-qr.png";
