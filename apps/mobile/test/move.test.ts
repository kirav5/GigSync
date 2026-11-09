import { Collection, ownedName } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { describe, expect, it, vi } from "vitest";
import { KEYS_COLLECTION, MoveError, moveLegacy, planMove } from "../src/adapters/store/move.js";
import { FakeLegacy, FLAG, newProfile, openVault } from "./store-fakes.js";

const ASHA = "usr_01J0000000000000000000AAAA" as UserId;
const now = new Date("2026-11-09T10:00:00+05:30");
const JOBS = ownedName(Collection.jobs, ASHA);
const SECRETS = { signing: "c2lnbg==", encryption: "ZW5j" };
const ACCOUNT = { session: { user: ASHA, token: "secret-token" } };

/** A phone as the old app left it: the agent's records, the device's secrets, and Preferences that are neither. */
const oldPhone = () =>
  new FakeLegacy({
    "settings:account": ACCOUNT,
    "keys:device:v2": SECRETS,
    [`${JOBS}:eng_1`]: { n: 1 },
    [`${JOBS}:eng_2`]: { n: 2 },
    [`${ownedName(Collection.inboxCursor, ASHA)}:eng_1|${ASHA}`]: { last: 3, held: [] },
    "permission-explained-mic": "yes",
    "speech-read-aloud": true,
  });

describe("planning the move", () => {
  it("takes stored records, splitting at the first colon, and leaves other Preferences alone", () => {
    expect(planMove(["settings:account", "keys:device:v2", `${JOBS}:eng_1`, "permission-explained-mic"])).toEqual([
      { key: "settings:account", collection: "settings", id: "account" },
      { key: "keys:device:v2", collection: KEYS_COLLECTION, id: "device:v2" },
      { key: `${JOBS}:eng_1`, collection: JOBS, id: "eng_1" },
    ]);
    expect(planMove(["unknown:thing", "unknown@usr_1:thing", ":empty", "nocolon", FLAG])).toEqual([]);
  });
});

describe("moving the old store", () => {
  it("copies every record sealed, marks it, then deletes the plaintext", async () => {
    const legacy = oldPhone();
    const vault = await openVault(newProfile());
    expect(await moveLegacy(legacy, vault, now)).toEqual({ first: true, copied: 5, removed: 5, unreadable: 0 });

    expect(await vault.get(Collection.settings, "account")).toEqual(ACCOUNT);
    expect(await vault.get(KEYS_COLLECTION, "device:v2")).toEqual(SECRETS);
    expect(await vault.list(JOBS)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(await vault.moved()).toEqual({ at: now.toISOString(), records: 5 });
    expect([...legacy.data.keys()].sort()).toEqual([FLAG, "permission-explained-mic", "speech-read-aloud"].sort());
  });

  it("run again changes nothing", async () => {
    const legacy = oldPhone();
    const profile = newProfile();
    await moveLegacy(legacy, await openVault(profile), now);
    const vault = await openVault(profile);
    await vault.put(JOBS, "eng_1", { n: 1, signed: true });

    expect(await moveLegacy(legacy, vault, now)).toEqual({ first: false, copied: 0, removed: 0, unreadable: 0 });
    expect(await vault.get(JOBS, "eng_1")).toEqual({ n: 1, signed: true });
    expect(await vault.ids(JOBS)).toEqual(["eng_1", "eng_2"]);
  });

  it("stopped before the mark, deletes nothing and copies again on the next start", async () => {
    const legacy = oldPhone();
    const profile = newProfile();
    const vault = await openVault(profile);
    const stop = vi.spyOn(vault, "markMoved").mockRejectedValueOnce(new Error("closed"));
    await expect(moveLegacy(legacy, vault, now)).rejects.toThrow("closed");
    expect(legacy.data.size).toBe(7);
    expect(await vault.moved()).toBeUndefined();
    stop.mockRestore();

    // What the old store holds by then is the truth: the app never ran on the half-made copy.
    legacy.data.set(`${JOBS}:eng_1`, JSON.stringify({ n: 1, later: true }));
    const result = await moveLegacy(legacy, await openVault(profile), now);
    expect(result).toEqual({ first: true, copied: 5, removed: 5, unreadable: 0 });
    expect(await vault.get(JOBS, "eng_1")).toEqual({ n: 1, later: true });
  });

  it("stopped while deleting, finishes on the next start without touching what the app wrote since", async () => {
    const legacy = oldPhone();
    const profile = newProfile();
    const vault = await openVault(profile);
    legacy.failRemovals = 3;
    await expect(moveLegacy(legacy, vault, now)).rejects.toThrow("remove failed");
    expect(await vault.moved()).toBeDefined();
    expect(legacy.data.has(FLAG)).toBe(true);
    await vault.put(JOBS, "eng_1", { n: 1, signed: true });
    await vault.delete(JOBS, "eng_2");

    const result = await moveLegacy(legacy, await openVault(profile), now);
    expect(result).toMatchObject({ first: false, removed: 3 });
    expect(await vault.get(JOBS, "eng_1")).toEqual({ n: 1, signed: true });
    expect(await vault.get(KEYS_COLLECTION, "device:v2")).toEqual(SECRETS);
    expect([...legacy.data.keys()].filter((k) => k.includes(":"))).toEqual([]);
  });

  it("after the move, keeps plaintext that turns up only where the new store has no such record", async () => {
    const legacy = oldPhone();
    const vault = await openVault(newProfile());
    await moveLegacy(legacy, vault, now);
    // A tab still running the app from before the move writes to the old store.
    legacy.data.set(`${JOBS}:eng_1`, JSON.stringify({ n: 1, stale: true }));
    legacy.data.set(`${JOBS}:eng_9`, JSON.stringify({ n: 9 }));
    legacy.data.set("keys:device:v2", JSON.stringify({ signing: "other", encryption: "other" }));

    expect(await moveLegacy(legacy, vault, now)).toEqual({ first: false, copied: 1, removed: 3, unreadable: 0 });
    expect(await vault.get(JOBS, "eng_1")).toEqual({ n: 1 });
    expect(await vault.get(JOBS, "eng_9")).toEqual({ n: 9 });
    expect(await vault.get(KEYS_COLLECTION, "device:v2")).toEqual(SECRETS);
  });

  it("leaves a record it cannot read where it is", async () => {
    const legacy = new FakeLegacy({ "settings:lang": "kn" });
    legacy.data.set("settings:broken", "{not json");
    const vault = await openVault(newProfile());
    expect(await moveLegacy(legacy, vault, now)).toEqual({ first: true, copied: 1, removed: 1, unreadable: 1 });
    expect(legacy.data.get("settings:broken")).toBe("{not json");
  });

  it("deletes nothing when a copied record is not in the new store", async () => {
    const legacy = oldPhone();
    const vault = await openVault(newProfile());
    vi.spyOn(vault, "putAll").mockResolvedValueOnce();
    await expect(moveLegacy(legacy, vault, now)).rejects.toThrow(MoveError);
    expect(legacy.data.size).toBe(7);
    expect(await vault.moved()).toBeUndefined();
  });

  it("deletes nothing when a copied record reads back differently", async () => {
    const legacy = oldPhone();
    const vault = await openVault(newProfile());
    vi.spyOn(vault, "get").mockResolvedValueOnce({ not: "what was written" });
    await expect(moveLegacy(legacy, vault, now)).rejects.toThrow(MoveError);
    expect(legacy.data.size).toBe(7);
    expect(await vault.moved()).toBeUndefined();
  });

  it("marks a phone with nothing to move, so later plaintext never overwrites it", async () => {
    const vault = await openVault(newProfile());
    expect(await moveLegacy(new FakeLegacy({}), vault, now)).toEqual({
      first: true,
      copied: 0,
      removed: 0,
      unreadable: 0,
    });
    expect(await vault.moved()).toEqual({ at: now.toISOString(), records: 0 });
  });
});
