import { describe, expect, it } from "vitest";
import {
  areaBand,
  DRIVER_SPECS,
  driversFromScope,
  EstimateRequest,
  JobQuantities,
  quantitiesFit,
  scopeFromDrivers,
  TRADE_DRIVERS,
  Trade,
} from "../src/index.js";

/** ADR 0041 §1 and §4: price drivers, their mapping to ADR 0030's buckets, and a record's quantities. */

describe("price drivers", () => {
  it("every trade's drivers have a spec with a default and a spread", () => {
    for (const trade of Trade.options)
      for (const name of TRADE_DRIVERS[trade]) {
        const spec = DRIVER_SPECS[trade][name];
        expect(spec?.default).toBeDefined();
        expect(spec?.unknown.length).toBeGreaterThan(0);
      }
  });

  it("an estimate request may carry its trade's drivers, strictly, and old requests still parse", () => {
    const base = { city: "bengaluru", trade: "painter", scope: { rooms: "bhk4_plus", labour_only: "yes" } };
    expect(EstimateRequest.safeParse(base).success).toBe(true);
    expect(EstimateRequest.safeParse({ ...base, drivers: { area_sqft: 3000, surface: "both" } }).success).toBe(true);
    expect(EstimateRequest.safeParse({ ...base, drivers: { people: 4 } }).success).toBe(false);
    expect(EstimateRequest.safeParse({ ...base, drivers: { surface: "the big wall" } }).success).toBe(false);
  });

  it("maps old buckets to drivers and back", () => {
    expect(driversFromScope("cook", { people: "3_4", meals: "2" })).toEqual({ people: 3, meals: 2 });
    expect(driversFromScope("painter", { rooms: "bhk2", labour_only: "yes" })).toEqual({
      rooms: 2,
      paint_by: "household",
    });
    expect(scopeFromDrivers("cook", { people: 4, meals: 3 })).toEqual({ people: "3_4", meals: "3" });
    expect(scopeFromDrivers("painter", { area_sqft: 1500, paint_by: "worker" })).toEqual({ labour_only: "no" });
  });

  it("bands floor area for a record, which keeps only its trade's quantities", () => {
    expect(areaBand(3000)).toBe("2501_3500");
    expect(areaBand(9000)).toBe("5001_plus");
    const q = JobQuantities.parse({ area_band: "2501_3500", floors: 2 });
    expect(quantitiesFit("painter", q)).toBe(true);
    expect(quantitiesFit("cook", q)).toBe(false);
    expect(JobQuantities.safeParse({ notes: "words" }).success).toBe(false);
  });
});
