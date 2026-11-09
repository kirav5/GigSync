import { EngagementStatus } from "@gigsync/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  type Clock,
  nextSyncDelay,
  SWEEP_EVERY_MS,
  SYNC_AFTER_ACTION_MS,
  SYNC_FAST_MS,
  SYNC_SLOW_MS,
  SYNC_TALK_FRESH_MS,
  settle,
  sweepDue,
  talksMoving,
} from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

const S = EngagementStatus.enum;
const NOW = new Date("2026-11-09T10:00:00.000Z");
const QUIET = { previousMs: SYNC_FAST_MS, moved: false, talking: false };

/** A clock a test moves by hand. */
class MovableClock implements Clock {
  at = NOW.getTime();
  now() {
    return new Date(this.at);
  }
}

const jobAt = (status: EngagementStatus, agoMs: number, elsewhere = false) => ({
  engagement: { status, updated_at: new Date(NOW.getTime() - agoMs).toISOString() },
  ...(elsewhere ? { elsewhere: "dev_other" } : {}),
});
type Jobs = Parameters<typeof talksMoving>[0];
const moving = (...jobs: ReturnType<typeof jobAt>[]) => talksMoving(jobs as Jobs, NOW);

describe("the wait before the next mailbox check", () => {
  it("is fast after a check that moved a message, while a talk is moving, and just after the owner acted", () => {
    expect(nextSyncDelay({ ...QUIET, previousMs: SYNC_SLOW_MS, moved: true })).toBe(SYNC_FAST_MS);
    expect(nextSyncDelay({ ...QUIET, previousMs: SYNC_SLOW_MS, talking: true })).toBe(SYNC_FAST_MS);
    expect(nextSyncDelay({ ...QUIET, previousMs: SYNC_SLOW_MS, sinceActionMs: 0 })).toBe(SYNC_FAST_MS);
    expect(nextSyncDelay({ ...QUIET, sinceActionMs: SYNC_AFTER_ACTION_MS - 1 })).toBe(SYNC_FAST_MS);
  });

  it("grows step by step to the slow wait while nothing moves, and stays there", () => {
    const waits: number[] = [];
    let previousMs = SYNC_FAST_MS;
    for (let check = 0; check < 6; check++) {
      previousMs = nextSyncDelay({ ...QUIET, previousMs, sinceActionMs: SYNC_AFTER_ACTION_MS });
      waits.push(previousMs);
    }
    expect(waits).toEqual([4000, 8000, 16_000, SYNC_SLOW_MS, SYNC_SLOW_MS, SYNC_SLOW_MS]);
  });

  it("never falls below the fast wait, whatever the last one was", () => {
    expect(nextSyncDelay({ ...QUIET, previousMs: 0 })).toBeGreaterThan(SYNC_FAST_MS);
  });
});

describe("whether a talk is moving", () => {
  it("is so for a talk or an awaited signature that changed lately", () => {
    for (const status of [S.sent, S.clarifying, S.responded, S.negotiating, S.confirming])
      expect(moving(jobAt(status, 0))).toBe(true);
    expect(moving(jobAt(S.closed, 0), jobAt(S.negotiating, SYNC_TALK_FRESH_MS))).toBe(true);
  });

  it("is not for a deal made or over, a talk gone quiet, another device's job, or no jobs", () => {
    for (const status of [S.agreed, S.in_progress, S.delivered, S.closed, S.cancelled, S.expired])
      expect(moving(jobAt(status, 0))).toBe(false);
    expect(moving(jobAt(S.sent, SYNC_TALK_FRESH_MS + 1))).toBe(false);
    expect(moving(jobAt(S.negotiating, 0, true))).toBe(false);
    expect(moving()).toBe(false);
  });
});

describe("the looks through the phone's own jobs", () => {
  it("are due on the first sync, when a sync moved something, and once the last is old", () => {
    expect(sweepDue(undefined, 0, false)).toBe(true);
    expect(sweepDue(0, 1, true)).toBe(true);
    expect(sweepDue(0, SWEEP_EVERY_MS - 1, false)).toBe(false);
    expect(sweepDue(0, SWEEP_EVERY_MS, false)).toBe(true);
  });

  it("run on a phone's first sync, wait out quiet syncs, and run again when one sends or the pause is over", async () => {
    const relay = new MemoryRelay();
    const clock = new MovableClock();
    const worker = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true, clock });
    const household = await phone(relay, PRIYA, { autoConfirm: true, clock });
    const sweep = vi.spyOn(household.device.contacts, "sweep");

    await household.device.sync();
    expect(sweep).toHaveBeenCalledTimes(1);
    await household.device.sync();
    clock.at += SWEEP_EVERY_MS - 1;
    await household.device.sync();
    expect(sweep).toHaveBeenCalledTimes(1);

    // The owner's own move going out is something moving: the jobs are looked at on that sync.
    await household.device.request(fanNeed(65000), [worker.user]);
    expect(await household.device.sync()).toMatchObject({ sent: 1 });
    expect(sweep).toHaveBeenCalledTimes(2);

    await settle([worker.device, household.device]);
    const afterTalk = sweep.mock.calls.length;
    await household.device.sync();
    expect(sweep).toHaveBeenCalledTimes(afterTalk);
    clock.at += SWEEP_EVERY_MS;
    await household.device.sync();
    expect(sweep).toHaveBeenCalledTimes(afterTalk + 1);
  });
});
