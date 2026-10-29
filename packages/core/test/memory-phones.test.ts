import { type EngagementId, Role } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Collection, recall, settle } from "../src/index.js";
import { ASHA, cook, cookNeed, MemoryRelay, phone, RAVI_HOME } from "./phones.js";

describe("agent memory on two phones", () => {
  it("both agents remember a signed job once the cards arrive; a job that fails leaves no trace of the other side", async () => {
    const relay = new MemoryRelay();
    const home = await phone(relay, RAVI_HOME, { autoConfirm: true });
    const asha = await phone(relay, ASHA, { worker: cook(), autoConfirm: true });
    const [sent] = await home.device.request(cookNeed(900000, { people: "4" }), [asha.user]);
    const id = sent?.engagement.id as EngagementId;
    await settle([home.device, asha.device]);
    await home.device.answer(id, { meals: "2", pets: "no" });
    await settle([home.device, asha.device]);
    expect((await home.device.job(id)).contact).toBeDefined();

    const homeOwner = { storage: home.storage, me: { user: home.user } };
    const atHome = await recall(homeOwner, "cook", asha.user);
    expect(atHome.facts).toEqual({ people: "4", meals: "2", pets: "no" });
    expect(atHome.person).toMatchObject({ name: "Asha", role: Role.enum.provider, jobs: 1 });

    const ashaOwner = { storage: asha.storage, me: { user: asha.user } };
    const atAsha = await recall(ashaOwner, "cook", home.user);
    expect(atAsha.person).toMatchObject({ name: "Ravi", role: Role.enum.requester, jobs: 1 });
    expect(atAsha.person?.details).toEqual({ people: "4", meals: "2", pets: "no" });
    expect(atAsha.askedBefore.map((a) => a.key)).toEqual(["meals", "pets"]);
    expect(JSON.stringify(await asha.storage.list(Collection.memory))).not.toContain(RAVI_HOME.phone);
  });

  it("no deal: neither phone remembers the other side", async () => {
    const relay = new MemoryRelay();
    const home = await phone(relay, RAVI_HOME, { autoConfirm: true });
    const asha = await phone(relay, ASHA, { worker: cook(), autoConfirm: true });
    await home.device.request(cookNeed(500000, { people: "4", meals: "2", pets: "no" }), [asha.user]);
    await settle([home.device, asha.device]);
    expect(await home.storage.list(Collection.memory)).toEqual([]);
    expect(await asha.storage.list(Collection.memory)).toEqual([]);
  });
});
