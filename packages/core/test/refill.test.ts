import { type BoardProfile, type DeviceId, type EngagementId, EngagementStatus, Role } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  Collection,
  FloorError,
  hasHistory,
  movePromptAnswered,
  movePromptDue,
  refillFromCard,
  settle,
  TaskKind,
  withFloor,
} from "../src/index.js";
import { BENGALURU, BENGALURU_RATES, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";
import { movingOwner } from "./transfer-fakes.js";

const NOW = new Date("2026-10-31T10:00:00+05:30");
const CARD: BoardProfile = {
  display_name: "Ravi",
  trades: ["electrician"],
  area: BENGALURU,
  area_name: "Indiranagar",
  rate_paise: 70000,
  languages: ["kn", "xx", "en"],
  about: "Fans and wiring",
};

describe("refilling the card on a new phone", () => {
  it("puts the public card back, with the usual rate as the floor until the worker gives theirs", () => {
    const refilled = refillFromCard(CARD, { radius_km: 10, rates: BENGALURU_RATES });
    expect(refilled.worker).toEqual({
      trades: ["electrician"],
      rate: { opening_paise: 70000, limit_paise: 70000 },
      base: BENGALURU,
      radius_km: 10,
      rates: BENGALURU_RATES,
      ask_me: [],
      // ADR 0063: the line about the work, which the agent's questions are written from.
      about: "Fans and wiring",
      floor_missing: true,
    });
    expect(refilled.languages).toEqual(["kn", "en"]);
    expect(refilled.about).toBe("Fans and wiring");
  });

  it("takes the worker's lowest price only when it is a positive amount up to the usual rate", () => {
    const { worker } = refillFromCard(CARD, { radius_km: 10 });
    const set = withFloor(worker, 55000);
    expect(set.rate).toEqual({ opening_paise: 70000, limit_paise: 55000 });
    expect(set.floor_missing).toBeUndefined();
    for (const bad of [0, -100, 70001, 550.5]) expect(() => withFloor(worker, bad)).toThrow(FloorError);
  });

  it("until then, the agent shows the worker each request before quoting", async () => {
    const relay = new MemoryRelay();
    const { worker } = refillFromCard(CARD, { radius_km: 10 });
    const ravi = await phone(relay, RAVI, { worker });
    const priya = await phone(relay, PRIYA, { autoConfirm: true });
    const [job] = await priya.device.request(fanNeed(90000, { problem: "dead" }), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    await settle([priya.device, ravi.device]);
    const tasks = await ravi.device.tasks();
    expect(tasks.find((t) => t.kind === TaskKind.approveRequest)?.detail).toMatchObject({
      flagged: [],
      no_floor: true,
    });
    expect((await ravi.device.job(id)).offers).toEqual([]);

    await ravi.device.approveRequest(id);
    await settle([priya.device, ravi.device]);
    const offers = (await ravi.device.job(id)).offers;
    expect(offers.length).toBeGreaterThan(0);
    // Never below the usual rate: it is the only floor this phone knows.
    for (const o of offers.filter((x) => x.by === Role.enum.provider))
      expect(o.offer.price_paise).toBeGreaterThanOrEqual(70000);
    expect((await ravi.device.job(id)).engagement.status).not.toBe(EngagementStatus.enum.cancelled);
  });

  it("with the lowest price given, the agent quotes on its own again", async () => {
    const relay = new MemoryRelay();
    const worker = withFloor(refillFromCard(CARD, { radius_km: 10 }).worker, 55000);
    const ravi = await phone(relay, RAVI, { worker });
    const priya = await phone(relay, PRIYA);
    await priya.device.request(fanNeed(90000, { problem: "dead" }), [ravi.user]);
    await settle([priya.device, ravi.device]);
    expect((await ravi.device.tasks()).map((t) => t.kind)).not.toContain(TaskKind.approveRequest);
  });
});

describe("asking 'Moving from another phone?' after sign-in", () => {
  /** The new phone's context: its own device, the directory's answer, and whether a link is waiting. */
  const context = (owner: ReturnType<typeof movingOwner>, devices: DeviceId[], linkWaiting = false) => ({
    me: owner.fresh.device,
    devices: async () => devices,
    linkWaiting,
  });

  it("asks an owner with nothing here yet and another active phone, once", async () => {
    const owner = movingOwner();
    const { storage } = owner.fresh;
    const withOld = context(owner, [owner.old.device, owner.fresh.device]);
    expect(await movePromptDue(storage, owner.user, withOld)).toBe(true);
    await movePromptAnswered(storage, owner.user, NOW);
    expect(await movePromptDue(storage, owner.user, withOld)).toBe(false);
    // Kept per phone: it never travels in a move.
    expect(await owner.fresh.base.ids(Collection.settings)).toHaveLength(1);
  });

  it("does not ask someone new, whose only device is this phone", async () => {
    const owner = movingOwner();
    expect(await movePromptDue(owner.fresh.storage, owner.user, context(owner, [owner.fresh.device]))).toBe(false);
  });

  it("does not ask over a QR link opened before sign-in, nor the directory then", async () => {
    const owner = movingOwner();
    const asked: string[] = [];
    const ctx = {
      ...context(owner, [owner.old.device], true),
      devices: async () => {
        asked.push("directory");
        return [owner.old.device];
      },
    };
    expect(await movePromptDue(owner.fresh.storage, owner.user, ctx)).toBe(false);
    expect(asked).toEqual([]);
  });

  it("does not ask an owner who already has jobs or chats on this phone", async () => {
    const owner = movingOwner();
    const { storage } = owner.fresh;
    await storage.put(Collection.chat, "cht_1", { id: "cht_1" });
    expect(await hasHistory(storage)).toBe(true);
    expect(await movePromptDue(storage, owner.user, context(owner, [owner.old.device]))).toBe(false);
  });
});
