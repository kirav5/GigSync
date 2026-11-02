import { HttpMethod } from "@gigsync/core";
import { driversFromScope, Estimate, type EstimateRequest } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { K_MIN } from "../src/estimates/constants.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { sql } from "./sql.js";
import { clearUnits, seedUnitJobs, serveAt, times } from "./unit-helpers.js";

/**
 * ADR 0041 §3: a range from the job's drivers, per-unit rates times quantity, with a confidence label, from two sources
 * only: GigSync's agreed jobs and the community rate card (no cloud model, founders 2026-10-31).
 */

const NOW = new Date();
const JAYANAGAR = "jayanagar";
const RUPEE = 100;

const VILLA: EstimateRequest = {
  city: "bengaluru",
  trade: "painter",
  scope: { rooms: "bhk4_plus", labour_only: "yes" },
  drivers: { rooms: 4, house_type: "villa", surface: "both", area_sqft: 3000, floors: 2 },
};
const COOK_DRIVERS = { people: 4, meals: 2, days_week: 6 };
const COOK: EstimateRequest = {
  city: "bengaluru",
  trade: "cook",
  scope: { people: "3_4", meals: "2" },
  drivers: COOK_DRIVERS,
};
/** A cooking job as a phone that sends quantities records it. */
const cookJob = (price: number, more: { area?: string; agreedAt?: Date } = {}) => ({
  trade: "cook",
  price,
  scope: { people: "3_4", meals: "2" },
  qty: { people: 4, days_week: 6 },
  ...more,
});
const ratio = (e: Estimate) => e.high_paise / e.low_paise;

beforeEach(clearUnits);

describe("the rate card, with no GigSync jobs to go on", () => {
  it("a 4BHK villa, inside and outside, ~3,000 sq ft, 2 floors: wide but sensible, low confidence, says why", async () => {
    const e = (await serveAt(VILLA, NOW)) as Estimate;
    // Factor 3,000 × (1 + 0.8 × 1.1) × 1.15 = 6,486 typical; who buys the paint (0.4–1) and the finish (1–1.5) assumed.
    expect(e).toMatchObject({ unit: "job", confidence: "low", spread_by: "paint_by" });
    expect(e.assumed).toEqual(["paint_by", "finish"]);
    expect(e.typical_paise).toBe(324_300 * RUPEE);
    expect(e.low_paise).toBe(164_080 * RUPEE);
    expect(e.high_paise).toBe(516_340 * RUPEE);
    // Half the unknowns' span (UNKNOWN_SHARE): still about three-fold, honest that two choices are missing.
    expect(ratio(e)).toBeGreaterThan(2.5);
    // Rests on the rate card alone, whose painting figures are a GigSync seed: low confidence, and it says so.
    expect(e.basis).toMatchObject({ kind: "rate_card", blend: ["rate_card"], gigsync_jobs: 0, sources: [] });
    expect(e.basis.rate_card?.sources.map((s) => s.name)).toEqual(["GigSync seed, unverified"]);
  });

  it("the same villa with every driver known is narrower and surer", async () => {
    const known = {
      ...VILLA,
      drivers: { ...VILLA.drivers, paint_by: "household", finish: "plain" },
    } as EstimateRequest;
    const e = (await serveAt(known, NOW)) as Estimate;
    expect(e.confidence).toBe("medium");
    expect(e.assumed).toBeUndefined();
    expect(ratio(e)).toBeLessThan(1.7);
  });

  it("a cook for 2 meals and 3–4 people: a tight range above the legal minimum", async () => {
    const e = (await serveAt({ ...COOK, drivers: { people: 4, meals: 2 } }, NOW)) as Estimate;
    expect(e).toMatchObject({ unit: "month", confidence: "medium", low_paise: 756_000, typical_paise: 1_026_000 });
    expect(e.high_paise).toBe(1_400_000);
    expect(ratio(e)).toBeLessThanOrEqual(2);
    expect(e.basis.legal_minimum_paise).toBe(643_000);
    expect(e.basis.floored).toBe(false);
    expect(e.basis.rate_card?.sources.map((s) => s.name)).toEqual([
      "Cookzy Bengaluru FAQ; Solve24 cook prices",
      "Karnataka minimum wages 2026",
    ]);
  });
});

describe("GigSync's own per-unit rates", () => {
  it("count once K_MIN jobs between K_MIN workers and households, and outweigh the rate card", async () => {
    await seedUnitJobs(times(K_MIN, cookJob(1_200_000)), NOW);
    const e = (await serveAt(COOK, NOW)) as Estimate;
    // ₹12,000 from 10 jobs, blended with the card's ₹7,560 / ₹10,260 / ₹12,960 weighing as 5 jobs.
    expect(e).toMatchObject({ low_paise: 1_052_000, typical_paise: 1_142_000, high_paise: 1_232_000 });
    expect(e.basis).toMatchObject({ kind: "gigsync", blend: ["gigsync", "rate_card"], gigsync_jobs: K_MIN });
    expect(e.confidence).toBe("medium");
  });

  it.each([
    ["fewer than K_MIN jobs", K_MIN - 1, false],
    ["one pair's jobs", K_MIN + 5, true],
  ])("show nothing of %s", async (_, count, onePair) => {
    const lone = 1_777_700;
    await seedUnitJobs(times(count, cookJob(lone)), NOW, onePair);
    const e = (await serveAt(COOK, NOW)) as Estimate;
    expect(e.basis).toMatchObject({ kind: "rate_card", blend: ["rate_card"], gigsync_jobs: 0 });
    expect(JSON.stringify(e)).not.toContain("1777");
  });

  it("lean from the city to the area as the area's jobs grow", async () => {
    await seedUnitJobs(
      [...times(K_MIN, cookJob(1_000_000)), ...times(K_MIN, cookJob(1_400_000, { area: JAYANAGAR }))],
      NOW,
    );
    const e = (await serveAt({ ...COOK, area: JAYANAGAR }, NOW)) as Estimate;
    // The area has 10 / (10 + 20) of the say: ₹14,000 × 1/3 + ₹10,000 × 2/3 = ₹11,333, then the card (₹10,260) as 5
    // jobs beside 20.
    expect(e.typical_paise).toBe(1_112_000);
    expect(e.basis).toMatchObject({ area: JAYANAGAR, gigsync_jobs: 2 * K_MIN });
  });

  it("weigh recent jobs more", async () => {
    const elevenMonths = new Date(NOW.getTime() - 330 * 86_400_000);
    await seedUnitJobs(
      [...times(K_MIN, cookJob(1_000_000, { agreedAt: elevenMonths })), ...times(K_MIN, cookJob(1_400_000))],
      NOW,
    );
    // Equal weights would put the GigSync median at ₹10,000; recency puts it at ₹14,000, ahead of the card.
    expect(((await serveAt(COOK, NOW)) as Estimate).typical_paise).toBeGreaterThan(1_300_000);
  });

  it("read old records' buckets as drivers: 3–4 people is three, so four people cost a little more", async () => {
    await seedUnitJobs(times(K_MIN, { trade: "cook", price: 1_200_000, scope: { people: "3_4", meals: "2" } }), NOW);
    // ₹12,000 for 2 meals × 3 people is ₹6,000 a meal-month; 4 people add 8%: ₹12,960, then the card as 5 jobs.
    expect(await serveAt(COOK, NOW)).toMatchObject({ typical_paise: 1_206_000 });
  });

  it("price painting per sq ft from the area band a record keeps", async () => {
    const painting = { trade: "painter", price: 30_000_000, scope: { rooms: "bhk3", labour_only: false } };
    await seedUnitJobs(times(K_MIN, { ...painting, qty: { area_band: "2501_3500", surface: "inside" } }), NOW);
    const req: EstimateRequest = {
      city: "bengaluru",
      trade: "painter",
      scope: { rooms: "bhk3", labour_only: "no" },
      drivers: { area_sqft: 1500, surface: "inside", house_type: "flat", paint_by: "worker", finish: "plain" },
    };
    // ₹3,00,000 for 3,000 sq ft is ₹100 a sq ft; 1,500 sq ft is ₹1,50,000; the card's ₹50 a sq ft weighs as 5 jobs.
    expect(await serveAt(req, NOW)).toMatchObject({ typical_paise: 12_500_000, basis: { kind: "gigsync" } });
  });
});

describe("older phones", () => {
  it("a scope-only request takes the same path, its buckets read as drivers", async () => {
    const old: EstimateRequest = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
    const asDrivers = { ...old, drivers: driversFromScope(old.trade, old.scope) } as EstimateRequest;
    const e = await serveAt(old, NOW);
    expect(e).toMatchObject({ unit: "month", basis: { kind: "rate_card", legal_minimum_paise: 643_000 } });
    expect(e).toEqual(await serveAt(asDrivers, NOW));
  });
});

describe("migration 0011", () => {
  it("adds the quantity columns to job_records", async () => {
    const rows = await sql<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'job_records' AND column_name LIKE 'qty_%'",
    );
    expect(rows.map((r) => r.column_name).sort()).toEqual(
      [
        "area_band",
        // Migration 0012 (ADR 0046).
        "arrangement",
        "days_week",
        "finish",
        "floors",
        "hours",
        "house_type",
        "people",
        "points",
        "rooms",
        "surface",
        "tasks",
        "vehicle",
      ].map((c) => `qty_${c}`),
    );
  });
});

describe("POST /v1/estimates with drivers", () => {
  it("answers with a confidence label and the rate card's provenance", async () => {
    const p = await signIn("+919855510001");
    const res = await call(p, HttpMethod.post, "/estimates", VILLA);
    expect(res.status).toBe(200);
    const e = Estimate.parse(await res.json());
    expect(e).toMatchObject({ confidence: "low", spread_by: "paint_by", basis: { kind: "rate_card" } });
  });

  it("refuses a driver out of bounds, or one the trade does not have", async () => {
    const p = await signIn("+919855510002");
    const tiny = { ...VILLA, drivers: { area_sqft: 10 } };
    expect((await call(p, HttpMethod.post, "/estimates", tiny)).status).toBe(400);
    const wrong = { ...COOK, drivers: { floors: 2 } };
    expect((await call(p, HttpMethod.post, "/estimates", wrong)).status).toBe(400);
  });

  it("needs a session", async () => {
    expect((await call(undefined, HttpMethod.post, "/estimates", VILLA)).status).toBe(401);
  });
});
