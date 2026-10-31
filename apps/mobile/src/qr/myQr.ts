import { keepQr, qrOwner, type Storage, showMyQr } from "@gigsync/core";
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

/** The owner's live code, as the server gives it (making it on first ask). */
export const myQrOf = (account: Account): Promise<MyQr> => apiClient(account.session).myQr(ownerOf(account));

async function shown(mine: MyQr): Promise<ShownQr> {
  const link = myQrLink(mine.code);
  return { link, image: await qrDataUrl(link) };
}

/**
 * The owner's live QR, drawn on this phone: at once from the code kept in their storage, then again only if the
 * server (which makes it on first ask) says it changed, as after a new QR on another device. `show` gets each picture
 * in order; a slower drawing of an older code never replaces a newer one.
 */
export async function loadMyQr(account: Account, storage: Storage, show: (qr: ShownQr) => void): Promise<void> {
  let latest = 0;
  const draw = (mine: MyQr) => {
    const mineIs = ++latest;
    void shown(mine).then((picture) => {
      if (mineIs === latest) show(picture);
    });
  };
  await showMyQr(storage, () => myQrOf(account), draw);
}

/** A new QR in place of the old one, which stops finding the owner at once; kept on this phone from now on. */
export async function replaceMyQr(account: Account, storage: Storage): Promise<ShownQr> {
  const mine = await apiClient(account.session).replaceQr(ownerOf(account));
  await keepQr(storage, mine);
  return shown(mine);
}

/** The name a downloaded QR picture is saved under. */
export const QR_FILE = "gigsync-qr.png";
