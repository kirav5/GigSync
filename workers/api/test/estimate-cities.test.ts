import type { Estimate, EstimateRequest } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { clearUnits, seedUnitJobs, serveAt, times } from "./unit-helpers.js";

/** ADR 0061: a city's estimate rests on its own jobs and its own card; with neither, there is none until it learns. */
const NOW = new Date("2026-11-07T10:00:00+05:30");
const ENOUGH = 10;
const cook = (city: string): EstimateRequest => ({
  city,
  trade: "cook",
  scope: { people: "3_4", meals: "2" },
  drivers: { people: 4, meals: 2, days_week: 6 },
});
const cookJob = (price: number, city?: string) => ({
  trade: "cook",
  price,
  scope: { people: "3_4", meals: "2" },
  qty: { people: 4, days_week: 6 },
  ...(city ? { city } : {}),
});

describe("estimates by city", () => {
  beforeEach(clearUnits);

  it("give a city with no jobs and no rate card nothing, not another city's prices", async () => {
    await seedUnitJobs(times(ENOUGH, cookJob(1_200_000)), NOW);
    expect(await serveAt(cook("kanpur"), NOW)).toEqual({ none: "unavailable" });
    expect(((await serveAt(cook("bengaluru"), NOW)) as Estimate).basis.gigsync_jobs).toBe(ENOUGH);
  });

  it("learn a new city's prices from its own jobs, with no card and no other state's minimum", async () => {
    await seedUnitJobs([...times(ENOUGH, cookJob(800_000, "kanpur")), ...times(ENOUGH, cookJob(1_600_000))], NOW);
    const e = (await serveAt(cook("kanpur"), NOW)) as Estimate;
    expect(e.basis).toMatchObject({ kind: "gigsync", blend: ["gigsync"], gigsync_jobs: ENOUGH });
    expect(e.basis.legal_minimum_paise).toBeUndefined();
    expect(e.typical_paise).toBeLessThan(1_000_000);
  });
});
