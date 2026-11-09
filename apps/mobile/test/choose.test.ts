import { Collection, MemoryStorage } from "@gigsync/core";
import { describe, expect, it } from "vitest";
import { chooseStorage, type Platform } from "../src/adapters/store/choose.js";
import type { EncryptedStorage } from "../src/adapters/store/encrypted.js";
import { FakeLegacy, FLAG, newProfile, openVault } from "./store-fakes.js";

const now = new Date("2026-11-09T10:00:00+05:30");
const LANG = "lang";

/** A browser with an old phone's language setting in the plaintext store, and a working encrypted store. */
function browser(change: Partial<Platform> = {}) {
  const profile = newProfile();
  const legacyStore = new FakeLegacy({ [`${Collection.settings}:${LANG}`]: "kn" });
  const platform: Platform = {
    native: false,
    openVault: () => openVault(profile),
    legacy: new MemoryStorage(),
    legacyStore,
    movedOut: async () => legacyStore.data.has(FLAG),
    now: () => now,
    ...change,
  };
  return { platform, legacyStore, profile };
}

const noIndexedDb = () => Promise.reject(new Error("no IndexedDB"));

describe("choosing the phone's store", () => {
  it("uses the encrypted store on the web, with the old records moved into it", async () => {
    const { platform, legacyStore } = browser();
    const storage = await chooseStorage(platform);
    expect(storage).not.toBe(platform.legacy);
    expect(await storage.get(Collection.settings, LANG)).toBe("kn");
    expect([...legacyStore.data.keys()]).toEqual([FLAG]);
  });

  it("leaves a native build on the old store, untouched", async () => {
    const { platform, legacyStore } = browser({ native: true });
    expect(await chooseStorage(platform)).toBe(platform.legacy);
    expect(legacyStore.data.size).toBe(1);
  });

  it("stays on the old store, losing nothing, where the encrypted one cannot open", async () => {
    const { platform, legacyStore } = browser({ openVault: noIndexedDb });
    expect(await chooseStorage(platform)).toBe(platform.legacy);
    expect(legacyStore.data.size).toBe(1);
  });

  it("stays on the old store when the encrypted one never answers", async () => {
    const { platform } = browser({ openVault: () => new Promise<EncryptedStorage>(() => undefined) });
    expect(await chooseStorage(platform, 20)).toBe(platform.legacy);
  });

  it("refuses to start on the emptied old store once the records were moved", async () => {
    const { platform } = browser();
    await chooseStorage(platform);
    await expect(chooseStorage({ ...platform, openVault: noIndexedDb })).rejects.toThrow("no IndexedDB");
  });

  it("stays on the old store for this start when the copy fails, and moves on the next", async () => {
    const { platform, legacyStore, profile } = browser();
    const failing = async () => {
      const vault = await openVault(profile);
      vault.putAll = () => Promise.reject(new Error("no space"));
      return vault;
    };
    expect(await chooseStorage({ ...platform, openVault: failing })).toBe(platform.legacy);
    expect(legacyStore.data.size).toBe(1);

    const storage = await chooseStorage(platform);
    expect(await storage.get(Collection.settings, LANG)).toBe("kn");
  });

  it("uses the encrypted store when only clearing the old plaintext failed", async () => {
    const { platform, legacyStore } = browser();
    legacyStore.failRemovals = 1;
    const storage = await chooseStorage(platform);
    expect(storage).not.toBe(platform.legacy);
    expect(await storage.get(Collection.settings, LANG)).toBe("kn");
    // The next start clears what was left.
    await chooseStorage(platform);
    expect([...legacyStore.data.keys()]).toEqual([FLAG]);
  });
});
