import { describe, expect, it } from "vitest";
import {
  freshSpeed,
  MODEL_ROUTE_TIMEOUT_MS,
  mayResumeAlone,
  Network,
  networkOf,
  recordSpeed,
  SPEED_SAMPLES,
  Speed,
  type SpeedRecord,
  tooSlow,
} from "../src/index.js";

/** The speed guard and the Wi-Fi rule for the phone's own model (ADR 0040 amendment). */

const SLOW = MODEL_ROUTE_TIMEOUT_MS + 1;
const QUICK = MODEL_ROUTE_TIMEOUT_MS - 1;
const timed = (times: readonly number[]): SpeedRecord => times.reduce((r, ms) => recordSpeed(r, ms), freshSpeed());

describe("the speed guard", () => {
  it("calls a phone too slow once 3 of its first 5 routing answers miss the time limit", () => {
    expect(timed([SLOW, QUICK, SLOW]).verdict).toBe(Speed.measuring);
    const slow = timed([SLOW, QUICK, SLOW, SLOW]);
    expect(slow.verdict).toBe(Speed.slow);
    expect(tooSlow(slow)).toBe(true);
  });

  it("calls it fast after 5 answers with at most 2 slow, and stops counting", () => {
    const fast = timed([SLOW, QUICK, QUICK, SLOW, QUICK]);
    expect(fast.verdict).toBe(Speed.fast);
    expect(recordSpeed(fast, SLOW)).toBe(fast);
    expect(timed([SLOW, QUICK, QUICK, SLOW, QUICK, SLOW, SLOW]).verdict).toBe(Speed.fast);
  });

  it("keeps a verdict of slow until it starts again", () => {
    const slow = timed([SLOW, SLOW, SLOW]);
    expect(recordSpeed(slow, QUICK)).toBe(slow);
    expect(tooSlow(freshSpeed())).toBe(false);
  });

  it("an answer exactly at the limit is in time; a nonsense time is ignored", () => {
    expect(timed(Array(SPEED_SAMPLES).fill(MODEL_ROUTE_TIMEOUT_MS)).verdict).toBe(Speed.fast);
    expect(timed([Number.NaN, -1]).times).toEqual([]);
  });

  it("takes another limit when given one", () => {
    expect(recordSpeed(recordSpeed(recordSpeed(freshSpeed(), 20, 10), 20, 10), 20, 10).verdict).toBe(Speed.slow);
  });

  it("knows no record as not slow", () => {
    expect(tooSlow(undefined)).toBe(false);
  });
});

describe("the Wi-Fi rule", () => {
  it("Wi-Fi and a cable may resume a download by themselves", () => {
    expect(networkOf({ type: "wifi" })).toBe(Network.unmetered);
    expect(networkOf({ type: "ethernet" })).toBe(Network.unmetered);
    expect(mayResumeAlone(Network.unmetered)).toBe(true);
  });

  it("mobile data, or the data saver on any network, never does", () => {
    expect(networkOf({ type: "cellular" })).toBe(Network.metered);
    expect(networkOf({ type: "wifi", saveData: true })).toBe(Network.metered);
    expect(networkOf({ saveData: true })).toBe(Network.metered);
    expect(mayResumeAlone(Network.metered)).toBe(false);
  });

  it("a browser that does not say (Safari, desktop Chrome) means asking", () => {
    expect(networkOf(undefined)).toBe(Network.unknown);
    expect(networkOf({})).toBe(Network.unknown);
    expect(networkOf({ type: "unknown" })).toBe(Network.unknown);
    expect(networkOf({ type: "other" })).toBe(Network.unknown);
    expect(mayResumeAlone(Network.unknown)).toBe(false);
  });
});
