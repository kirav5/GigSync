import type { EstimateRequest } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { legalFloorPaise } from "../src/estimates/floor.js";
import { marketSince } from "../src/estimates/unit-rates.js";

const NOW = new Date("2026-10-29T10:00:00Z");
const COOK: EstimateRequest = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
const MAID: EstimateRequest = { city: "bengaluru", trade: "maid", scope: { rooms: "bhk2", frequency: "daily" } };
const PAINTER: EstimateRequest = { city: "bengaluru", trade: "painter", scope: { rooms: "bhk2", labour_only: "yes" } };

describe("the legal floor", () => {
  it("is the notified day rate pro-rated to the card's hours, times the days a month worked, for monthly work", () => {
    expect(legalFloorPaise(COOK)).toBe(643_000);
    expect(legalFloorPaise(MAID)).toBe(350_000);
    const weekly = { ...MAID, scope: { rooms: "bhk2", frequency: "weekly" } } as EstimateRequest;
    expect(legalFloorPaise(weekly)).toBe(59_000);
  });

  it("does not apply to a job priced as a whole", () => {
    expect(legalFloorPaise(PAINTER)).toBeUndefined();
  });
});

describe("the market window", () => {
  it("starts the same moment twelve calendar months back", () => {
    expect(marketSince(NOW).toISOString()).toBe("2025-10-29T10:00:00.000Z");
    expect(marketSince(new Date("2026-01-05T00:00:00Z")).toISOString()).toBe("2025-01-05T00:00:00.000Z");
  });
});
