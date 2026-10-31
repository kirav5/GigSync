import { describe, expect, it } from "vitest";
import {
  A2A_STATE,
  canonicalJson,
  EngagementStatus,
  Envelope,
  Grant,
  MAX_HOP_DEPTH,
  nextStatus,
  TERMINAL_STATUSES,
  TRANSITIONS,
} from "../src/index.js";

const ULID = "01J0000000000000000000AAAA";
const envelope = {
  v: 1,
  id: `msg_${ULID}`,
  from: { user: `usr_${ULID}`, device: `dev_${ULID}` },
  to: { user: `usr_${ULID}` },
  engagement: `eng_${ULID}`,
  seq: 0,
  kind: "request",
  sent_at: "2026-10-21T09:14:03+05:30",
  expires_at: "2026-10-22T09:14:03+05:30",
  epk: "ZXBr",
  keys: { [`dev_${ULID}`]: "a2V5" },
  ciphertext: "aGVsbG8=",
  sig: "c2ln",
};

describe("Envelope", () => {
  it("accepts a well-formed envelope", () => {
    expect(Envelope.parse(envelope).kind).toBe("request");
  });
  it("rejects a hop deeper than the limit", () => {
    const deep = { ...envelope, hop: { chain: `chn_${ULID}`, depth: MAX_HOP_DEPTH + 1 } };
    expect(Envelope.safeParse(deep).success).toBe(false);
  });
  it("rejects an envelope sealed to no device", () => {
    expect(Envelope.safeParse({ ...envelope, keys: {} }).success).toBe(false);
  });
  it("rejects an id without its prefix", () => {
    expect(Envelope.safeParse({ ...envelope, id: ULID }).success).toBe(false);
  });
  it("canonical JSON sorts keys and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: [{ d: undefined, c: "x" }] })).toBe('{"a":[{"c":"x"}],"b":1}');
  });
});

describe("Engagement transitions", () => {
  it("a question runs sent → responded → closed", () => {
    expect(nextStatus("draft", "request")).toBe("sent");
    expect(nextStatus("sent", "response")).toBe("responded");
    expect(nextStatus("responded", "review")).toBe("closed");
  });
  it("a job runs through offers, two signatures, progress, delivery, review", () => {
    expect(nextStatus("sent", "quote")).toBe("negotiating");
    expect(nextStatus("negotiating", "counter")).toBe("negotiating");
    expect(nextStatus("negotiating", "agree")).toBe("confirming");
    expect(nextStatus("confirming", "agree")).toBe("agreed");
    expect(nextStatus("agreed", "update")).toBe("in_progress");
    expect(nextStatus("in_progress", "delivery")).toBe("delivered");
    expect(nextStatus("delivered", "clarify")).toBe("revision");
    expect(nextStatus("revision", "delivery")).toBe("delivered");
    expect(nextStatus("delivered", "review")).toBe("closed");
  });
  it("a new offer while confirming reopens negotiation", () => {
    expect(nextStatus("confirming", "counter")).toBe("negotiating");
    expect(nextStatus("confirming", "cancel")).toBe("cancelled");
  });
  it("terminal states accept nothing", () => {
    for (const s of TERMINAL_STATUSES) expect(Object.keys(TRANSITIONS[s])).toHaveLength(0);
  });
  it("every status has an A2A state and every table key is a status", () => {
    for (const s of EngagementStatus.options) {
      expect(A2A_STATE[s]).toBeTruthy();
      expect(TRANSITIONS[s]).toBeDefined();
    }
  });
});

describe("Grant", () => {
  it("rejects an hour window that ends before it starts only by range", () => {
    const g = {
      id: `grt_${ULID}`,
      grantee: `usr_${ULID}`,
      topic: "location",
      mode: "auto",
      hours: { start: 9, end: 25 },
    };
    expect(Grant.safeParse(g).success).toBe(false);
  });
});
