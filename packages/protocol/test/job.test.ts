import { describe, expect, it } from "vitest";
import { BODY, BoardProfile, BoardQuery, EnvelopeKind, JobRequest, MAX_ROUNDS, Offer } from "../src/index.js";

const ULID = "01J0000000000000000000AAAA";
const area = { lat: 12.97, lon: 77.64 };

describe("job bodies", () => {
  it("every envelope kind has a body schema", () => {
    for (const k of EnvelopeKind.options) expect(BODY[k]).toBeDefined();
  });
  it("a request carries the need but no budget", () => {
    const req = JobRequest.parse({ trade: "electrician", need: "Fan dead", when: "tomorrow 10am", area, budget: 900 });
    expect(req.details).toEqual({});
    expect("budget" in req).toBe(false);
  });
  it("rejects an unknown trade and an offer past the round limit", () => {
    expect(JobRequest.safeParse({ trade: "astronaut", need: "x", when: "now", area }).success).toBe(false);
    const offer = { offer_id: `off_${ULID}`, round: MAX_ROUNDS + 1, price_paise: 50000, slot: "10am", scope: "fan" };
    expect(Offer.safeParse(offer).success).toBe(false);
  });
});

describe("board", () => {
  const profile = { display_name: "Ravi", trades: ["electrician"], area, area_name: "Indiranagar", rate_paise: 50000 };
  it("accepts a worker card and defaults the optional fields", () => {
    expect(BoardProfile.parse(profile)).toMatchObject({ languages: [], about: "" });
  });
  it("refuses repeated trades", () => {
    expect(BoardProfile.safeParse({ ...profile, trades: ["maid", "maid"] }).success).toBe(false);
  });
  it("coerces a query string and applies defaults", () => {
    const q = BoardQuery.parse({ trade: "plumber", lat: "12.9", lon: "77.6" });
    expect(q).toMatchObject({ lat: 12.9, lon: 77.6, radius_km: 5, limit: 10 });
  });
  it("caps the radius", () => {
    expect(BoardQuery.safeParse({ trade: "plumber", lat: 1, lon: 1, radius_km: 500 }).success).toBe(false);
  });
});
