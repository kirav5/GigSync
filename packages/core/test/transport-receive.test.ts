import { newDeviceSecrets } from "@gigsync/crypto";
import type { DeviceId, EngagementId, UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { MailTransport, MemoryStorage, type Received, SecretKeys } from "../src/index.js";
import { TestClock } from "./mentor-phones.js";
import { MemoryRelay } from "./phones.js";

/**
 * Architecture review row 2: a message counts as delivered only once it was handled. Before, it was marked seen
 * before it was opened and acknowledged before the agent saw it, so a crash or a timeout at that moment lost a quote,
 * a signature or a payment note for good.
 */

const person = () => ({ user: `usr_${ulid()}` as UserId, device: `dev_${ulid()}` as DeviceId });
const JOB = `eng_${ulid()}` as EngagementId;

async function twoPhones() {
  const relay = new MemoryRelay();
  const household = person();
  const worker = person();
  const theirs = new SecretKeys(newDeviceSecrets());
  const mine = new SecretKeys(newDeviceSecrets());
  relay.register(household.user, household.device, await theirs.publicKeys());
  relay.register(worker.user, worker.device, await mine.publicKeys());
  const clock = new TestClock(new Date("2026-11-07T10:00:00+05:30"));
  const sender = new MailTransport(relay.for(household), new MemoryStorage(), theirs, clock, household);
  const storage = new MemoryStorage();
  const receiver = (relayFor = relay.for(worker)) => new MailTransport(relayFor, storage, mine, clock, worker);
  await sender.send(worker.user, JOB, "update", { text: FIRST });
  await sender.send(worker.user, JOB, "update", { text: SECOND });
  await sender.flush();
  return { relay, worker, receiver };
}

const FIRST = "on the way";
const SECOND = "here now";
const texts = (got: Received[]) => got.map((r) => (r.body as { text: string }).text);

describe("receiving", () => {
  it("hands each message over in order, then acknowledges them", async () => {
    const { relay, worker, receiver } = await twoPhones();
    const got: Received[] = [];
    expect(await receiver().receive(async (r) => void got.push(r))).toBe(2);
    expect(texts(got)).toEqual([FIRST, SECOND]);
    expect(await relay.for(worker).inbox()).toEqual([]);
  });

  it("loses nothing when handling fails part-way: what was not handled comes again, once", async () => {
    const { relay, worker, receiver } = await twoPhones();
    const first: Received[] = [];
    const failing = async (r: Received) => {
      if (texts([r])[0] === SECOND) throw new Error("the phone died");
      first.push(r);
    };
    await expect(receiver().receive(failing)).rejects.toThrow("the phone died");
    expect(texts(first)).toEqual([FIRST]);
    expect(await relay.for(worker).inbox()).toHaveLength(2);
    const again: Received[] = [];
    await receiver().receive(async (r) => void again.push(r));
    expect(texts(again)).toEqual([SECOND]);
    expect(await relay.for(worker).inbox()).toEqual([]);
  });

  it("loses nothing when the directory times out while opening", async () => {
    const { relay, worker, receiver } = await twoPhones();
    const down = { ...relay.for(worker), directory: () => Promise.reject(new Error("directory timeout")) };
    await expect(receiver(down).receive(async () => undefined)).rejects.toThrow("directory timeout");
    const got: Received[] = [];
    await receiver().receive(async (r) => void got.push(r));
    expect(texts(got)).toEqual([FIRST, SECOND]);
  });

  it("gives up a message that fails every time, after three tries, so the rest are not held back", async () => {
    const { relay, worker, receiver } = await twoPhones();
    const transport = receiver();
    const got: Received[] = [];
    const poisoned = async (r: Received) => {
      if (texts([r])[0] === FIRST) throw new Error("a bug in the handler");
      got.push(r);
    };
    for (let i = 0; i < 2; i++) await expect(transport.receive(poisoned)).rejects.toThrow("a bug");
    expect(await transport.receive(poisoned)).toBe(1);
    expect(texts(got)).toEqual([SECOND]);
    expect(await relay.for(worker).inbox()).toEqual([]);
  });
});
