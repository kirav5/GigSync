import { describe, expect, it } from "vitest";
import { NOT_COMPLETED, settle } from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

const ROUNDS = 6;

describe("a worker signed in on two devices", () => {
  it("negotiates each request on one device only; the other shows it and follows it being called off", async () => {
    const relay = new MemoryRelay();
    const phoneOne = await phone(relay, RAVI, { worker: electrician() });
    const laptop = await phone(relay, RAVI, { worker: electrician(), user: phoneOne.user });
    const household = await phone(relay, PRIYA);
    const [job] = await household.device.request(fanNeed(65000, { problem: "hums" }), [phoneOne.user]);
    const id = job?.engagement.id as never;

    // The laptop syncs first, so it claims the request; the phone keeps it as answered elsewhere.
    for (let i = 0; i < ROUNDS; i++) await settle([household.device, laptop.device, phoneOne.device]);
    const answering = await laptop.device.job(id);
    const mirrored = await phoneOne.device.job(id);
    expect(answering.elsewhere).toBeUndefined();
    expect(answering.offers_made).toBeGreaterThan(0);
    expect(mirrored.elsewhere).toBeDefined();
    expect(mirrored.offers_made).toBe(0);
    expect(await phoneOne.device.tasks()).toEqual([]);

    // Every envelope the worker sent came from the laptop: one negotiation, nothing out of turn.
    const fromWorker = relay.stored.filter((e) => e.from.user === phoneOne.user);
    expect(fromWorker.length).toBeGreaterThan(0);
    expect(new Set(fromWorker.map((e) => e.from.device)).size).toBe(1);

    await household.device.cancelJob(id);
    await settle([household.device, laptop.device, phoneOne.device]);
    const ended = await phoneOne.device.job(id);
    expect(ended.cancel).toBeDefined();
    expect(NOT_COMPLETED.has(ended.engagement.status)).toBe(true);
  });
});
