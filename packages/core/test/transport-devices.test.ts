import { newDeviceSecrets } from "@gigsync/crypto";
import type { DeviceId, EngagementId, UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { MailTransport, MemoryStorage, SecretKeys } from "../src/index.js";
import { TestClock } from "./mentor-phones.js";
import { MemoryRelay } from "./phones.js";

/**
 * A person who signs in again has a new device. Messages sent to them afterwards must be sealed to it too: a device
 * list kept for as long as the app ran sealed a household's second request to the worker's old phone only, and his
 * new phone dropped it unread.
 */

const person = () => ({ user: `usr_${ulid()}` as UserId, device: `dev_${ulid()}` as DeviceId });
const JOB = `eng_${ulid()}` as EngagementId;

describe("sealing to a person's devices", () => {
  it("reaches a device they signed in on after the first message, once the list is a minute old", async () => {
    const relay = new MemoryRelay();
    const household = person();
    const worker = person();
    const keys = new SecretKeys(newDeviceSecrets());
    relay.register(household.user, household.device, await keys.publicKeys());
    relay.register(worker.user, worker.device, await new SecretKeys(newDeviceSecrets()).publicKeys());
    const clock = new TestClock(new Date("2026-11-02T10:00:00+05:30"));
    const transport = new MailTransport(relay.for(household), new MemoryStorage(), keys, clock, household);

    const first = await transport.send(worker.user, JOB, "request", { need: "fan" });
    expect(Object.keys(first.keys)).toEqual([worker.device]);

    // He signs out and in again: a new device, while her app stays open.
    const again = `dev_${ulid()}` as DeviceId;
    relay.register(worker.user, again, await new SecretKeys(newDeviceSecrets()).publicKeys());
    clock.advance(61_000);
    const second = await transport.send(worker.user, JOB, "request", { need: "switchboard" });
    expect(Object.keys(second.keys).sort()).toEqual([worker.device, again].sort());
  });
});
