import { Capacitor } from "@capacitor/core";
import type { Storage } from "@gigsync/core";
import { log } from "@gigsync/core";
import { chooseStorage } from "./choose.js";
import { EncryptedStorage } from "./encrypted.js";
import { legacyStore, movedOut, PreferencesStorage } from "./preferences.js";

/**
 * Asks the browser, once, not to clear this site's storage when the device runs short: jobs, chats and the device's
 * keys live only here. Browsers answer by their own rules (Chrome mostly says yes to an installed app or one allowed
 * to notify; Firefox asks the owner), so the answer is logged either way and kept, and the question is not repeated.
 */
async function askToPersist(vault: EncryptedStorage): Promise<void> {
  try {
    if (await vault.persistence()) return;
    if (!navigator.storage?.persist) {
      log.warn("durable storage cannot be asked for in this browser");
      return;
    }
    const granted = await navigator.storage.persist();
    await vault.markPersistence({ at: new Date().toISOString(), granted });
    if (granted) log.info("durable storage granted");
    else log.warn("durable storage refused: the browser may clear this phone's records when short of space");
  } catch (err) {
    log.warn("durable storage not asked", { error: err instanceof Error ? err.name : typeof err });
  }
}

async function choose(): Promise<Storage> {
  const storage = await chooseStorage({
    native: Capacitor.isNativePlatform(),
    openVault: () => EncryptedStorage.open(indexedDB),
    legacy: new PreferencesStorage(),
    legacyStore,
    movedOut,
    now: () => new Date(),
  });
  if (storage instanceof EncryptedStorage) void askToPersist(storage);
  return storage;
}

/** A store that is still being chosen: every call waits for it, so nothing is read before the move is done. */
class PendingStorage implements Storage {
  constructor(private readonly chosen: Promise<Storage>) {}
  async get<T>(collection: string, id: string) {
    return (await this.chosen).get<T>(collection, id);
  }
  async put<T>(collection: string, id: string, value: T) {
    return (await this.chosen).put(collection, id, value);
  }
  async delete(collection: string, id: string) {
    return (await this.chosen).delete(collection, id);
  }
  async list<T>(collection: string) {
    return (await this.chosen).list<T>(collection);
  }
  async ids(collection: string) {
    return (await this.chosen).ids(collection);
  }
  /** Done once every write begun before the call is kept. The old store writes at once; the encrypted one seals first. */
  async settled(): Promise<void> {
    const storage = await this.chosen;
    if (storage instanceof EncryptedStorage) await storage.settled();
  }
}

declare global {
  interface Window {
    /**
     * Dev builds only: the phone's storage, for the browser tests to seed and read records now that they are sealed,
     * and to wait for a write before they reload the page.
     */
    gigsyncStorage?: PendingStorage;
  }
}

let phone: PendingStorage | undefined;

/**
 * This phone's storage, opened once however often it is asked for (React's StrictMode asks twice): two openings
 * would race to move the old store.
 */
export function phoneStorage(): Storage {
  phone ??= new PendingStorage(choose());
  if (import.meta.env.DEV) window.gigsyncStorage = phone;
  return phone;
}
