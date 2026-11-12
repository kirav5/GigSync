import { Collection, ownedName } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Database } from "../src/adapters/store/database.js";
import { EnvelopeError, IV_BYTES, newStorageKey, open, seal } from "../src/adapters/store/envelope.js";
import { newProfile, openVault } from "./store-fakes.js";

const ASHA = "usr_01J0000000000000000000AAAA" as UserId;
const LATA = "usr_01J0000000000000000000BBBB" as UserId;
const JOB = { engagement: { id: "eng_1", status: "open" }, price_paise: 900_000, note: "ಅಡುಗೆ, सुबह" };
const utf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("a sealed record", () => {
  it("opens to what was sealed, under a key script cannot export", async () => {
    const key = await newStorageKey();
    const sealed = await seal(key, "jobs", "eng_1", JOB);
    expect(await open(key, "jobs", "eng_1", sealed)).toEqual(JOB);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });

  it("uses a fresh IV for every write, and shows none of the value", async () => {
    const key = await newStorageKey();
    const [a, b] = await Promise.all([seal(key, "jobs", "eng_1", JOB), seal(key, "jobs", "eng_1", JOB)]);
    expect(a.slice(1, 1 + IV_BYTES)).not.toEqual(b.slice(1, 1 + IV_BYTES));
    expect(a).not.toEqual(b);
    expect(utf8(a)).not.toContain("price_paise");
  });

  it("does not open as another id, another collection or another owner's record", async () => {
    const key = await newStorageKey();
    const mine = ownedName(Collection.jobs, ASHA);
    const sealed = await seal(key, mine, "eng_1", JOB);
    await expect(open(key, mine, "eng_2", sealed)).rejects.toThrow(EnvelopeError);
    await expect(open(key, Collection.jobs, "eng_1", sealed)).rejects.toThrow(EnvelopeError);
    await expect(open(key, ownedName(Collection.jobs, LATA), "eng_1", sealed)).rejects.toThrow(EnvelopeError);
    // The place is not a joined string: collection "a" + id "b:c" is not collection "a:b" + id "c".
    await expect(open(key, "a:b", "c", await seal(key, "a", "b:c", JOB))).rejects.toThrow(EnvelopeError);
  });

  it("does not open when altered, or with another key", async () => {
    const key = await newStorageKey();
    const sealed = await seal(key, "jobs", "eng_1", JOB);
    const altered = sealed.slice();
    altered[altered.length - 1] = (altered[altered.length - 1] ?? 0) ^ 1;
    await expect(open(key, "jobs", "eng_1", altered)).rejects.toThrow(EnvelopeError);
    await expect(open(await newStorageKey(), "jobs", "eng_1", sealed)).rejects.toThrow(EnvelopeError);
  });
});

describe("encrypted storage", () => {
  it("keeps, reads, lists and deletes records, also after a restart", async () => {
    const profile = newProfile();
    const first = await openVault(profile);
    await first.put(Collection.jobs, "eng_2", { n: 2 });
    await first.put(Collection.jobs, "eng_1", JOB);
    expect(await first.get(Collection.jobs, "missing")).toBeUndefined();

    const again = await openVault(profile);
    expect(await again.get(Collection.jobs, "eng_1")).toEqual(JOB);
    expect(await again.list(Collection.jobs)).toEqual([JOB, { n: 2 }]);
    expect(await again.ids(Collection.jobs)).toEqual(["eng_1", "eng_2"]);
    await again.delete(Collection.jobs, "eng_1");
    expect(await again.ids(Collection.jobs)).toEqual(["eng_2"]);
  });

  it("lists one collection of one owner, and nothing of any other", async () => {
    const vault = await openVault(newProfile());
    const ashaJobs = ownedName(Collection.jobs, ASHA);
    await vault.put(ashaJobs, "eng_1", { owner: "asha" });
    await vault.put(ownedName(Collection.jobs, LATA), "eng_1", { owner: "lata" });
    await vault.put(ownedName(Collection.chat, ASHA), "eng_1", { chat: true });
    // Names that begin like another: `jobs` itself, and a collection whose name only starts with it.
    await vault.put(Collection.jobs, "eng_1", { owner: "nobody" });
    await vault.put(`${ashaJobs}x`, "eng_1", { owner: "other" });
    await vault.put(Collection.jobs, `${ASHA}:eng_1`, { odd: true });

    expect(await vault.list(ashaJobs)).toEqual([{ owner: "asha" }]);
    expect(await vault.ids(ashaJobs)).toEqual(["eng_1"]);
    expect(await vault.ids(Collection.jobs)).toEqual(["eng_1", `${ASHA}:eng_1`]);
    expect(await vault.list(ownedName(Collection.jobs, LATA))).toEqual([{ owner: "lata" }]);
    expect(await vault.list(Collection.payments)).toEqual([]);
  });

  it("stores only sealed bytes, and refuses a record put in another's place", async () => {
    const profile = newProfile();
    const vault = await openVault(profile);
    await vault.put(Collection.jobs, "eng_1", JOB);
    await vault.put(Collection.jobs, "eng_2", { n: 2 });
    const db = await Database.open(profile);
    const [one, two] = await db.list(Collection.jobs);
    if (!one || !two) throw new Error("two records expected");
    expect(utf8(one.sealed)).not.toContain("price_paise");

    await db.putAll([{ ...one, sealed: two.sealed }]);
    await expect(vault.get(Collection.jobs, "eng_1")).rejects.toThrow(EnvelopeError);
    // A list leaves the record it cannot open out, and still gives the rest.
    expect(await vault.list(Collection.jobs)).toEqual([{ n: 2 }]);
  });

  it("two openings of a new profile at once share one key", async () => {
    const profile = newProfile();
    const [a, b] = await Promise.all([openVault(profile), openVault(profile)]);
    await a.put(Collection.settings, "lang", "kn");
    expect(await b.get(Collection.settings, "lang")).toBe("kn");
  });
});

describe("the order of calls", () => {
  it("is the order records are kept in, without waiting for each", async () => {
    const vault = await openVault(newProfile());
    // Sealing a large value takes longer than a small one: unordered, the first write could land last.
    void vault.put(Collection.settings, "lang", "x".repeat(200_000));
    void vault.put(Collection.settings, "lang", "kn");
    expect(await vault.get(Collection.settings, "lang")).toBe("kn");

    void vault.delete(Collection.settings, "lang");
    expect(await vault.ids(Collection.settings)).toEqual([]);
    void vault.put(Collection.settings, "lang", "hi");
    await vault.settled();
    expect(await vault.list(Collection.settings)).toEqual(["hi"]);
  });

  it("goes on after a write that failed", async () => {
    const vault = await openVault(newProfile());
    const loop: { self?: unknown } = {};
    loop.self = loop;
    await expect(vault.put(Collection.settings, "bad", loop)).rejects.toThrow(TypeError);
    await vault.put(Collection.settings, "lang", "kn");
    expect(await vault.get(Collection.settings, "lang")).toBe("kn");
  });
});
