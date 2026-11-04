import { Arrangement, City, EstimateRequest, PriceUnit, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  arrangementEntry,
  arrangementIn,
  driverSpread,
  estimateLines,
  estimateRequest,
  estimateUnit,
  rateCardEntry,
} from "../src/index.js";

/** ADR 0046: maid and driver work by the hour, one visit, some days a week or the month. */

const T = Trade.enum;
const A = Arrangement.enum;
const U = PriceUnit.enum;
const BLR = City.enum.bengaluru;

describe("what a job is priced in", () => {
  it("gives maid and driver estimates in their arrangement's unit, and every other trade as before", () => {
    expect(estimateUnit(T.maid, A.hourly)).toBe(U.hour);
    expect(estimateUnit(T.maid, A.visit)).toBe(U.visit);
    expect(estimateUnit(T.driver, A.weekly)).toBe(U.week);
    expect(estimateUnit(T.driver)).toBe(U.month);
    expect(estimateUnit(T.cook, A.visit)).toBe(U.visit);
    expect(estimateUnit(T.electrician, A.hourly)).toBe(U.job);
    expect(estimateUnit(T.painter)).toBe(U.job);
  });

  it("keeps the city card's monthly entry, and a seed for each other arrangement", () => {
    expect(arrangementEntry(BLR, T.maid, A.monthly)).toBe(rateCardEntry(BLR, T.maid));
    for (const trade of [T.maid, T.driver])
      for (const a of [A.hourly, A.visit, A.weekly]) {
        const entry = arrangementEntry(BLR, trade, a);
        expect(entry?.sources.map((s) => s.name)).toEqual(["GigSync seed, unverified"]);
        expect(entry?.range.low).toBeLessThanOrEqual(entry?.range.typical ?? 0);
      }
    expect(arrangementEntry(BLR, T.cook, A.monthly)).toBe(rateCardEntry(BLR, T.cook));
    // ADR 0051: no figure yet for a cook's one meal or week, so no range rather than a monthly one.
    expect(arrangementEntry(BLR, T.cook, A.visit)).toBeUndefined();
    expect(arrangementEntry(BLR, T.plumber, A.monthly)).toBe(rateCardEntry(BLR, T.plumber));
  });
});

describe("the drivers each arrangement prices by", () => {
  it("prices an hour of a maid's time the same whatever the flat, and asks nothing", () => {
    const small = driverSpread(T.maid, { rooms: 1 }, A.hourly);
    const big = driverSpread(T.maid, { rooms: 4, tasks: "full" }, A.hourly);
    expect(small.typical).toBe(1);
    expect(big.typical).toBe(1);
    expect(driverSpread(T.maid, {}, A.hourly).assumed).toEqual([]);
  });

  it("prices a maid's visit by rooms and tasks, and a week by its days too", () => {
    expect(driverSpread(T.maid, { rooms: 3 }, A.visit).typical).toBeGreaterThan(
      driverSpread(T.maid, { rooms: 2 }, A.visit).typical,
    );
    expect(driverSpread(T.maid, {}, A.visit).assumed).not.toContain("frequency");
    const three = driverSpread(T.maid, { days_week: 3, rooms: 2, tasks: "sweep_mop_dishes" }, A.weekly);
    const six = driverSpread(T.maid, { days_week: 6, rooms: 2, tasks: "sweep_mop_dishes" }, A.weekly);
    expect(three.typical).toBeCloseTo(1);
    expect(six.typical).toBeCloseTo(2);
    expect(driverSpread(T.maid, { rooms: 2, tasks: "full" }, A.weekly).assumed).toEqual(["days_week"]);
  });

  it("prices a driver's trip by its hours and car, and an hour by the car alone", () => {
    expect(driverSpread(T.driver, { hours: 4, vehicle: "hatchback" }, A.visit).typical).toBe(4);
    expect(driverSpread(T.driver, { vehicle: "suv" }, A.hourly).typical).toBeCloseTo(1.1);
  });

  it("prices monthly work as it always was", () => {
    expect(driverSpread(T.maid, { rooms: 2 }, A.monthly)).toEqual(driverSpread(T.maid, { rooms: 2 }));
  });
});

describe("the estimate request a job's details make", () => {
  it("carries the arrangement the household chose, and the drivers it prices by", () => {
    const r = estimateRequest(BLR, T.maid, { arrangement: A.weekly, days_week: "3", rooms: "2" });
    expect(r).toMatchObject({ trade: T.maid, arrangement: A.weekly, drivers: { days_week: 3, rooms: 2 } });
    expect(EstimateRequest.safeParse(r).success).toBe(true);
  });

  it("leaves it out for a trade not priced by arrangement, and ignores words that are not one", () => {
    expect(estimateRequest(BLR, T.electrician, { arrangement: A.hourly })?.arrangement).toBeUndefined();
    expect(estimateRequest(BLR, T.cook, { arrangement: A.hourly })?.arrangement).toBeUndefined();
    expect(estimateRequest(BLR, T.cook, { arrangement: A.visit })?.arrangement).toBe(A.visit);
    expect(arrangementIn(T.maid, { arrangement: "every so often" })).toBeUndefined();
    expect(arrangementIn(T.driver, { arrangement: A.visit })).toBe(A.visit);
  });

  it("is refused by the schema for a trade without arrangements, or one that does not fit the work", () => {
    const cook = { city: BLR, trade: T.cook, scope: { people: "3_4", meals: "2" }, arrangement: A.hourly };
    expect(EstimateRequest.safeParse(cook).success).toBe(false);
    expect(EstimateRequest.safeParse({ ...cook, arrangement: A.visit }).success).toBe(true);
    const fix = { city: BLR, trade: T.electrician, scope: { problem: "other" }, arrangement: A.visit };
    expect(EstimateRequest.safeParse(fix).success).toBe(false);
  });
});

describe("what an estimate says it is for", () => {
  const found = (arrangement?: Arrangement) => {
    const request = estimateRequest(BLR, T.maid, arrangement ? { arrangement, rooms: "3" } : { rooms: "3" });
    if (!request) throw new Error("no request");
    const estimate = {
      unit: estimateUnit(T.maid, arrangement),
      low_paise: 10_000,
      typical_paise: 15_000,
      high_paise: 25_000,
      as_of: "2026-11-02",
      basis: { kind: "rate_card", gigsync_jobs: 0, floored: false },
    } as never;
    return estimateLines("en", { request, estimate })[0];
  };

  it("names no flat or frequency for an hour, the rooms alone for a visit, and the monthly scope for a month", () => {
    expect(found(A.hourly)?.params?.scope).toBe("");
    expect(found(A.visit)?.params?.scope).toBe(" (3 BHK)");
    expect(found(A.monthly)?.params?.scope).toBe(" (3 BHK, every day)");
  });
});
