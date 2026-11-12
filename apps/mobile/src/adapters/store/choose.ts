import type { Storage } from "@gigsync/core";
import { log } from "@gigsync/core";
import type { EncryptedStorage } from "./encrypted.js";
import { type LegacyStore, moveLegacy } from "./move.js";

/** What choosing a store needs from the platform, so the choice itself can be tested without one. */
export interface Platform {
  /** A Capacitor Android or iPhone build, not a browser. */
  native: boolean;
  /** Opens the encrypted store; rejects where IndexedDB or WebCrypto cannot be used. */
  openVault(): Promise<EncryptedStorage>;
  /** The old plaintext store, as storage and as what is moved out of. */
  legacy: Storage;
  legacyStore: LegacyStore;
  /** Whether the old store says its records were moved to the encrypted one. */
  movedOut(): Promise<boolean>;
  now(): Date;
}

/** An IndexedDB open that never answers (old Safari did this) must not leave the app waiting forever. */
const OPEN_TIMEOUT_MS = 10_000;
const inTime = (opening: Promise<EncryptedStorage>, ms: number) =>
  Promise.race([
    opening,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("encrypted storage did not open in time")), ms),
    ),
  ]);

const nameOf = (err: unknown) => (err instanceof Error ? err.name : typeof err);

/** The encrypted store with the old one moved into it, or the old one where this start could not finish the move. */
async function moved(vault: EncryptedStorage, platform: Platform): Promise<Storage> {
  try {
    const result = await moveLegacy(platform.legacyStore, vault, platform.now());
    if (result.first || result.removed > 0 || result.unreadable > 0) log.info("old store moved", { ...result });
    return vault;
  } catch (err) {
    // Marked as moved, the encrypted store is the truth and only clearing leftovers failed; unmarked, nothing was
    // deleted and the old store still holds everything, so this start stays on it and the next one tries again.
    const done = await vault.moved().catch(() => undefined);
    log.warn("old store not moved", { error: nameOf(err), staying: done ? "encrypted" : "old" });
    return done ? vault : platform.legacy;
  }
}

/**
 * Which store this start uses (ADR 0065), with the old one moved into the encrypted one where that is the answer.
 *
 * Native builds stay on Preferences until the SQLCipher store with a Keystore/Keychain key (ADR 0065 §5): a key in
 * the WebView's IndexedDB is not hardware-backed, and iOS may evict WebView storage under pressure. On the web the
 * encrypted store is used wherever it opens; where it cannot (a private window without IndexedDB, a page not on HTTPS
 * and so without WebCrypto, an old WebView) the app stays on the old store rather than lose anything. The one case
 * with no safe store is a phone whose records were already moved and whose encrypted store will not open: starting
 * on the empty old store would look like a new phone, make new device keys and sign in over the old ones, so that
 * start fails instead.
 */
export async function chooseStorage(platform: Platform, openTimeoutMs = OPEN_TIMEOUT_MS): Promise<Storage> {
  if (platform.native) return platform.legacy;
  let vault: EncryptedStorage;
  try {
    vault = await inTime(platform.openVault(), openTimeoutMs);
  } catch (err) {
    if (await platform.movedOut()) {
      log.error("encrypted storage cannot be opened, and this phone's records are in it", { error: nameOf(err) });
      throw err;
    }
    log.warn("encrypted storage unavailable: records stay in the old, unencrypted store", { error: nameOf(err) });
    return platform.legacy;
  }
  return moved(vault, platform);
}
