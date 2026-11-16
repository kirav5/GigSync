import { describe, expect, it } from "vitest";
import { mayFetchPackAlone, mayResumeAlone, Network, networkOf } from "../src/index.js";

/** The Wi-Fi rule for the phone's own model (ADR 0040 amendment). */

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

describe("the understanding pack's rule", () => {
  it("fetches by itself on Wi-Fi, on a phone or a computer", () => {
    expect(mayFetchPackAlone(Network.unmetered, false)).toBe(true);
    expect(mayFetchPackAlone(Network.unmetered, true)).toBe(true);
  });

  it("fetches on a computer whose browser does not say, never on a phone that does not", () => {
    expect(mayFetchPackAlone(Network.unknown, true)).toBe(true);
    expect(mayFetchPackAlone(Network.unknown, false)).toBe(false);
  });

  it("never fetches on mobile data or with the data saver, even on a computer", () => {
    expect(mayFetchPackAlone(Network.metered, true)).toBe(false);
    expect(mayFetchPackAlone(Network.metered, false)).toBe(false);
  });
});
