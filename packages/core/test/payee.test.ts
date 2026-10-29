import { describe, expect, it } from "vitest";
import {
  Collection,
  loadPayee,
  MemoryStorage,
  OwnerStorage,
  PAYEE_KEY,
  PayeeError,
  PayeeProblem,
  savePayee,
} from "../src/index.js";
import { phoneOwners } from "./owners.js";

/** What `savePayee` throws, as its problem; undefined when it saved. */
async function problemOf(save: Promise<void>): Promise<PayeeProblem | undefined> {
  try {
    await save;
    return undefined;
  } catch (err) {
    if (err instanceof PayeeError) return err.problem;
    throw err;
  }
}

describe("the payee store", () => {
  it("saves a valid payee in the owner's settings, without the spaces a keyboard adds", async () => {
    const storage = new MemoryStorage();
    await savePayee(storage, { vpa: " sita.devi@okaxis ", name: "  Sita Devi " });
    expect(await loadPayee(storage)).toEqual({ vpa: "sita.devi@okaxis", name: "Sita Devi" });
    expect(await storage.get(Collection.ownerSettings, PAYEE_KEY)).toEqual({
      vpa: "sita.devi@okaxis",
      name: "Sita Devi",
    });
  });

  it("refuses a bad UPI ID first", async () => {
    const storage = new MemoryStorage();
    expect(await problemOf(savePayee(storage, { vpa: "sita", name: "" }))).toBe(PayeeProblem.vpa);
    expect(await loadPayee(storage)).toBeUndefined();
  });

  it("refuses a 41-character name and an empty one", async () => {
    const storage = new MemoryStorage();
    const vpa = "sita@okaxis";
    expect(await problemOf(savePayee(storage, { vpa, name: "S".repeat(41) }))).toBe(PayeeProblem.name_long);
    expect(await problemOf(savePayee(storage, { vpa, name: "S".repeat(40) }))).toBeUndefined();
    expect(await problemOf(savePayee(storage, { vpa, name: "   " }))).toBe(PayeeProblem.name);
  });

  it("keeps each owner's payee on a shared phone, so the next worker on it is never paid to another's", async () => {
    const { phone, sita, geeta } = phoneOwners();
    await savePayee(new OwnerStorage(phone, sita), { vpa: "sita.devi@okaxis", name: "Sita Devi" });
    expect(await loadPayee(new OwnerStorage(phone, geeta))).toBeUndefined();
    expect((await loadPayee(new OwnerStorage(phone, sita)))?.vpa).toBe("sita.devi@okaxis");
  });

  it("treats a saved record that no longer passes the schema as none", async () => {
    const storage = new MemoryStorage();
    await storage.put(Collection.ownerSettings, PAYEE_KEY, { vpa: "not a upi id", name: "Sita" });
    expect(await loadPayee(storage)).toBeUndefined();
  });
});
