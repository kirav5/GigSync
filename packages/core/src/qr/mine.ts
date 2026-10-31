import { MyQr } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";

/** The owner's own QR code, one record in their settings on this phone. */
export const MY_QR_KEY = "my_qr";

/** The owner's QR code as this phone last knew it; undefined before the first one, or if the record is not one. */
export async function keptQr(storage: Storage): Promise<MyQr | undefined> {
  const parsed = MyQr.safeParse(await storage.get<unknown>(Collection.ownerSettings, MY_QR_KEY));
  return parsed.success ? parsed.data : undefined;
}

/** Keeps the owner's QR code on this phone, so the next open draws it without waiting for the server. */
export function keepQr(storage: Storage, qr: MyQr): Promise<void> {
  return storage.put(Collection.ownerSettings, MY_QR_KEY, qr);
}

/**
 * The owner's QR, at once and then fresh: `show` gets the kept code straight away (when there is one), then the
 * server's answer from `ask` only if its code differs, as when another device made a new QR. The answer is kept.
 * Resolves with the code finally shown; `ask`'s failure is thrown only when nothing was kept to show.
 */
export async function showMyQr(storage: Storage, ask: () => Promise<MyQr>, show: (qr: MyQr) => void): Promise<MyQr> {
  const kept = await keptQr(storage);
  if (kept) show(kept);
  let fresh: MyQr;
  try {
    fresh = await ask();
  } catch (err) {
    if (kept) return kept;
    throw err;
  }
  if (fresh.code !== kept?.code) {
    await keepQr(storage, fresh);
    show(fresh);
  }
  return fresh;
}
