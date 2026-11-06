import { describe, expect, it } from "vitest";
import {
  BODY,
  EnvelopeKind,
  MENTOR_KINDS,
  OfferRefusal,
  PART_PAYMENTS_PROTOCOL,
  QR_KINDS,
  RECOMMEND_PROTOCOL,
  RecommendLink,
  RecommendRefusal,
  RecommendRequest,
  SIDE_CHANNEL_KINDS,
} from "../src/index.js";

const USER = "usr_01J0000000000000000000AAAA";

describe("recommending a worker", () => {
  it("asks by a user id, and gets a code", () => {
    expect(RecommendRequest.safeParse({ worker: USER }).success).toBe(true);
    expect(RecommendRequest.safeParse({ worker: "+919800000000" }).success).toBe(false);
    expect(RecommendRequest.safeParse({}).success).toBe(false);
    expect(RecommendLink.safeParse({ code: "abcDEF012_-x" }).success).toBe(true);
    expect(RecommendLink.safeParse({ code: "short" }).success).toBe(false);
  });

  it("tells a phone on the job, without moving it, and carries nothing", () => {
    const k = EnvelopeKind.enum.recommended;
    expect(SIDE_CHANNEL_KINDS.has(k)).toBe(true);
    expect(MENTOR_KINDS.has(k) || QR_KINDS.has(k)).toBe(false);
    expect(BODY[k].parse({ note: "words" })).toEqual({});
  });

  it("takes a capability number of its own, above part payments", () => {
    expect(RECOMMEND_PROTOCOL).toBeGreaterThan(PART_PAYMENTS_PROTOCOL);
  });

  it("refuses in words of its own, so a phone never reads them as an offer's", () => {
    for (const refusal of RecommendRefusal.options) expect(OfferRefusal.safeParse(refusal).success).toBe(false);
  });
});
