import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { EncryptedStorage } from "../src/adapters/store/encrypted.js";
import type { LegacyStore } from "../src/adapters/store/move.js";

/** A browser profile's IndexedDB, empty: each test gets its own, and opens it again to stand for a restart. */
export const newProfile = () => new IDBFactory();

export const openVault = (profile: IDBFactory) => EncryptedStorage.open(profile);

export const FLAG = "storage-moved";

/** The old plaintext store in memory; `failRemovals` makes that many deletes fail. */
export class FakeLegacy implements LegacyStore {
  readonly data: Map<string, string>;
  failRemovals = 0;

  constructor(entries: Record<string, unknown>) {
    this.data = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
  }
  async keys() {
    return [...this.data.keys()];
  }
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async remove(key: string) {
    if (this.failRemovals > 0) {
      this.failRemovals -= 1;
      throw new Error("remove failed");
    }
    this.data.delete(key);
  }
  async flagMoved() {
    this.data.set(FLAG, "yes");
  }
}
