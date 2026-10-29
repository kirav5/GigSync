import { describe, expect, it } from "vitest";
import {
  Collection,
  claimLegacyRecords,
  loadPayee,
  MemoryStorage,
  OWNED_COLLECTIONS,
  OwnerStorage,
  PAYEE_KEY,
  type Storage,
} from "../src/index.js";
import { CLAIM_KEY } from "../src/owner/claim.js";
import { phoneOwners } from "./owners.js";

const NOW = new Date("2026-10-29T10:00:00Z");
const PAYEE = { vpa: "sita.devi@okaxis", name: "Sita Devi" };

/** A phone as an older build left it: one record in every collection, the UPI ID among its settings. */
async function legacyPhone(phone: Storage): Promise<void> {
  await Promise.all(OWNED_COLLECTIONS.map((c) => phone.put(c, "old", { from: c })));
  await phone.put(Collection.settings, PAYEE_KEY, PAYEE);
  await phone.put(Collection.settings, "lang", "hi");
}

describe("records from before owners were kept apart", () => {
  it("become the first signed-in owner's, every collection and the UPI ID, and the phone's settings stay", async () => {
    const { phone, sita, geeta } = phoneOwners();
    await legacyPhone(phone);
    expect(await claimLegacyRecords(phone, sita, NOW)).toBe(OWNED_COLLECTIONS.length + 1);
    const mine = new OwnerStorage(phone, sita);
    for (const c of OWNED_COLLECTIONS) {
      expect(await mine.get(c, "old")).toEqual({ from: c });
      expect(await phone.ids(c)).toEqual([]);
    }
    expect(await loadPayee(mine)).toEqual(PAYEE);
    expect(await loadPayee(new OwnerStorage(phone, geeta))).toBeUndefined();
    expect(await phone.get(Collection.settings, "lang")).toBe("hi");
    expect(await phone.get(Collection.settings, CLAIM_KEY)).toEqual({ owner: sita, at: NOW.toISOString() });
  });

  it("happen exactly once: the next owner to sign in claims nothing, not even a record left behind", async () => {
    const { phone, sita, geeta } = phoneOwners();
    await legacyPhone(phone);
    await claimLegacyRecords(phone, sita, NOW);
    await phone.put(Collection.jobs, "stray", { from: "an old tab" });
    expect(await claimLegacyRecords(phone, sita, NOW)).toBe(0);
    expect(await claimLegacyRecords(phone, geeta, NOW)).toBe(0);
    const theirs = new OwnerStorage(phone, geeta);
    for (const c of OWNED_COLLECTIONS) expect(await theirs.list(c)).toEqual([]);
  });

  it("gives a record that names its owner (memory, a move) to that owner", async () => {
    const { phone, sita, geeta } = phoneOwners();
    await phone.put(Collection.memory, geeta, { owner: geeta, facts: {} });
    await phone.put(Collection.journeys, "move-1", { id: "move-1", owner: sita });
    await claimLegacyRecords(phone, sita, NOW);
    expect(await new OwnerStorage(phone, geeta).get(Collection.memory, geeta)).toEqual({ owner: geeta, facts: {} });
    expect(await new OwnerStorage(phone, sita).list(Collection.memory)).toEqual([]);
    expect(await new OwnerStorage(phone, sita).ids(Collection.journeys)).toEqual(["move-1"]);
  });

  it("marks a phone with nothing old as claimed too", async () => {
    const phone = new MemoryStorage();
    const { sita } = phoneOwners();
    expect(await claimLegacyRecords(phone, sita, NOW)).toBe(0);
    expect(await phone.get(Collection.settings, CLAIM_KEY)).toMatchObject({ owner: sita });
  });
});
