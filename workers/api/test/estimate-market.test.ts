import { City, type Estimate, type EstimateRequest } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { K_MIN } from "../src/estimates/constants.js";
import { clearMarket, many, seedCookJobs } from "./market-helpers.js";
import { serveAt } from "./unit-helpers.js";

/**
 * Which of GigSync's agreed prices count (ADR 0039 §1, ADR 0041 §3): jobs agreed or done, attested or one-sided, over
 * the last twelve months, never cancelled; and nothing of a group shows below `K_MIN` jobs between `K_MIN` workers and
 * `K_MIN` households. Below that the range rests on the city's rate card alone.
 */

const NOW = new Date("2026-10-29T10:00:00Z");
const JAYANAGAR = "jayanagar";
const COOK: EstimateRequest = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
const IN_JAYANAGAR: EstimateRequest = { ...COOK, area: JAYANAGAR };

const serve = async (req: EstimateRequest) => (await serveAt(req, NOW)) as Estimate;

beforeEach(clearMarket);

describe("the jobs that count", () => {
  it("attested and one-sided alike, and never cancelled or older than twelve months", async () => {
    await seedCookJobs(many(K_MIN, 1_500_000, { area: JAYANAGAR }), NOW);
    const clean = await serve(IN_JAYANAGAR);
    await clearMarket();
    const year = new Date("2025-10-28T10:00:00Z");
    await seedCookJobs(
      [
        ...many(K_MIN - 2, 1_500_000, { area: JAYANAGAR }),
        { price: 1_500_000, area: JAYANAGAR, attested: false },
        { price: 1_500_000, area: JAYANAGAR, status: "agreed" },
        ...many(5, 9_000_000, { area: JAYANAGAR, status: "cancelled" }),
        ...many(5, 9_000_000, { area: JAYANAGAR, agreedAt: year }),
      ],
      NOW,
    );
    const e = await serve(IN_JAYANAGAR);
    expect(e.basis).toMatchObject({ kind: "gigsync", gigsync_jobs: K_MIN, area: JAYANAGAR });
    expect(e).toEqual(clean);
  });

  it("widen to the city when the area has fewer than K_MIN, counting jobs with no area too", async () => {
    await seedCookJobs([...many(4, 1_300_000, { area: JAYANAGAR }), ...many(K_MIN - 4, 1_300_000)], NOW);
    const e = await serve(IN_JAYANAGAR);
    expect(e.basis).toMatchObject({ kind: "gigsync", gigsync_jobs: K_MIN });
    expect(e.basis.area).toBeUndefined();
  });
});

describe("below K_MIN", () => {
  it("nothing of the jobs shows: no figure, no count, and the rate card answers alone", async () => {
    // A price the rate card does not have, so any trace of it in the answer would be a leak.
    const lone = 1_777_700;
    await seedCookJobs(many(K_MIN - 1, lone, { area: JAYANAGAR }), NOW);
    const e = await serve(IN_JAYANAGAR);
    expect(e.basis).toMatchObject({ kind: "rate_card", blend: ["rate_card"], gigsync_jobs: 0 });
    expect(e.basis.area).toBeUndefined();
    const text = JSON.stringify(e);
    expect(text).not.toContain("1777");
    expect(text).not.toContain(`"gigsync_jobs":${K_MIN - 1}`);
  });

  it("needs K_MIN different workers and households, not only K_MIN jobs: one pair's jobs show nothing", async () => {
    await seedCookJobs(many(K_MIN + 5, 1_888_800, { area: JAYANAGAR }), NOW, true);
    const e = await serve(IN_JAYANAGAR);
    expect(e.basis).toMatchObject({ kind: "rate_card", gigsync_jobs: 0 });
    expect(JSON.stringify(e)).not.toContain("1888");
  });
});

describe("the legal floor", () => {
  it("raises a figure below the statutory minimum, saying so", async () => {
    await seedCookJobs(many(K_MIN, 500_000, { area: JAYANAGAR }), NOW);
    const e = await serve(IN_JAYANAGAR);
    expect(e.low_paise).toBe(643_000);
    expect(e.basis).toMatchObject({ kind: "gigsync", legal_minimum_paise: 643_000, floored: true });
  });
});

describe("what GigSync's prices never answer", () => {
  it("a second city, until job records carry a city (migration 0010)", () => {
    expect(City.options).toEqual(["bengaluru"]);
  });
});
