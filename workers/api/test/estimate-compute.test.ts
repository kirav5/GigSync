import type { EstimateRequest } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { assembleEstimate, legalFloorPaise } from "../src/estimates/assemble.js";
import { type WebBand, webBand } from "../src/estimates/compute.js";
import { K_MIN } from "../src/estimates/constants.js";
import { firstMonthCounted, isShareableMonth } from "../src/estimates/months.js";
import { bandOf, percentile, withoutOutliers } from "../src/estimates/stats.js";
import { DropReason } from "../src/estimates/verify.js";
import { COOK, ELECTRICIAN, MAID, PAINTER, quotesAt } from "./estimate-fakes.js";

const NOW = new Date("2026-10-29T10:00:00Z");
const SITES = ["a.example", "b.example", "c.example"];

describe("percentiles and outliers", () => {
  it("interpolate between the closest ranks", () => {
    expect(percentile([10, 20, 30, 40], 0.25)).toBe(17.5);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([7], 0.75)).toBe(7);
    expect(percentile([], 0.5)).toBeUndefined();
    expect(bandOf([5, 1, 3, 2, 4])).toEqual({ low: 2, typical: 3, high: 4 });
  });

  it("drop values beyond 1.5 × IQR of the quartiles, on either side", () => {
    expect(withoutOutliers([100, 9000, 10000, 11000, 12000, 200000], (v) => v)).toEqual([9000, 10000, 11000, 12000]);
    expect(withoutOutliers([10, 11, 12], (v) => v)).toEqual([10, 11, 12]);
  });
});

describe("the web band", () => {
  it("is the 25th, 50th and 75th percentile of checked quotes in the request's unit", () => {
    const { result, dropped } = webBand(COOK, quotesAt([9000, 10000, 11000, 12000, 14000], SITES));
    expect(dropped).toEqual([]);
    expect(result).toMatchObject({ band: { low: 1000000, typical: 1100000, high: 1200000 }, count: 5 });
    expect((result as WebBand).sources.map((s) => s.amount_paise)).toEqual([
      900000, 1000000, 1100000, 1200000, 1400000,
    ]);
  });

  it("drops outliers before counting", () => {
    const { result, dropped } = webBand(COOK, quotesAt([500, 9000, 10000, 11000, 12000, 250000], SITES));
    expect(dropped).toEqual([DropReason.outlier, DropReason.outlier]);
    expect((result as WebBand).count).toBe(4);
  });

  it("needs three quotes", () => {
    expect(webBand(COOK, quotesAt([9000, 10000], SITES)).result).toBe("too_few_quotes");
  });

  it("needs two sites: one site saying it five times is one voice", () => {
    expect(webBand(COOK, quotesAt([9000, 10000, 11000, 12000, 13000], ["only.example"])).result).toBe("too_few_quotes");
  });

  it("counts only quotes that survive the checks and fit the scope", () => {
    const sourced = quotesAt([9000, 10000, 11000], SITES);
    sourced.quotes.push({ ...(sourced.quotes[0] as object), amount_rupees: 9500 });
    const sixPeople = quotesAt([16000, 17000], SITES, "month", { people: 6 });
    const { result, dropped } = webBand(COOK, {
      pages: [...sourced.pages, ...sixPeople.pages],
      quotes: [...sourced.quotes, ...sixPeople.quotes],
    });
    expect(dropped).toEqual([DropReason.amountNotInSentence, DropReason.scopeMismatch, DropReason.scopeMismatch]);
    expect((result as WebBand).count).toBe(3);
  });

  it("has nothing to say about a page that was never fetched", () => {
    const sourced = quotesAt([9000, 10000, 11000], SITES);
    expect(webBand(COOK, { pages: [], quotes: sourced.quotes }).result).toBe("too_few_quotes");
  });
});

const web = (low: number, typical: number, high: number, count = 5): WebBand => ({
  band: { low, typical, high },
  count,
  sources: [],
});

describe("the assembled estimate", () => {
  it("rounds to ₹10, or ₹1 per sq ft", () => {
    const e = assembleEstimate(ELECTRICIAN, { web: web(44_449, 50_051, 61_990), readAt: NOW, shared: [] }, NOW);
    expect(e).toMatchObject({ low_paise: 44_000, typical_paise: 50_000, high_paise: 62_000, unit: "job" });
    const perSqft = { ...PAINTER, scope: { labour_only: "yes" } } as EstimateRequest;
    const s = assembleEstimate(perSqft, { web: web(1_249, 1_510, 1_890), readAt: NOW, shared: [] }, NOW);
    expect(s).toMatchObject({ low_paise: 1_200, typical_paise: 1_500, high_paise: 1_900, unit: "sqft" });
  });

  it("never shows a figure below the legal minimum, and says so", () => {
    expect(legalFloorPaise(COOK)).toBe(643_000);
    expect(legalFloorPaise(MAID)).toBe(350_000);
    const weekly = { ...MAID, scope: { rooms: "bhk2", frequency: "weekly" } } as EstimateRequest;
    expect(legalFloorPaise(weekly)).toBe(59_000);
    expect(legalFloorPaise(PAINTER)).toBeUndefined();
    const e = assembleEstimate(MAID, { web: web(300_000, 340_000, 450_000), readAt: NOW, shared: [] }, NOW);
    expect(e).toMatchObject({ low_paise: 350_000, typical_paise: 350_000, high_paise: 450_000 });
    expect(e?.basis).toMatchObject({ legal_minimum_paise: 350_000, floored: true });
    const above = assembleEstimate(COOK, { web: web(900_000, 1_000_000, 1_100_000), readAt: NOW, shared: [] }, NOW);
    expect(above?.basis).toMatchObject({ legal_minimum_paise: 643_000, floored: false });
  });

  it("leaves shared prices unused below K_MIN, so no single price can be read back", () => {
    const nine = Array.from({ length: K_MIN - 1 }, () => 2_000_000);
    const e = assembleEstimate(COOK, { web: web(1_000_000, 1_100_000, 1_200_000), readAt: NOW, shared: nine }, NOW);
    expect(e).toMatchObject({ typical_paise: 1_100_000, basis: { gigsync_jobs: 0 } });
    expect(assembleEstimate(COOK, { web: undefined, readAt: undefined, shared: nine }, NOW)).toBeUndefined();
  });

  it("blends shared prices from K_MIN, weighted by count", () => {
    const ten = Array.from({ length: K_MIN }, () => 2_000_000);
    const e = assembleEstimate(COOK, { web: web(1_000_000, 1_000_000, 1_000_000, 10), readAt: NOW, shared: ten }, NOW);
    expect(e).toMatchObject({ low_paise: 1_500_000, typical_paise: 1_500_000, high_paise: 1_500_000 });
    expect(e?.basis.gigsync_jobs).toBe(K_MIN);
    const alone = assembleEstimate(COOK, { web: undefined, readAt: undefined, shared: ten }, NOW);
    expect(alone).toMatchObject({ typical_paise: 2_000_000, basis: { sources: [], gigsync_jobs: K_MIN } });
    expect(alone?.as_of).toBe(NOW.toISOString());
  });
});

describe("months of shared prices", () => {
  it("accept this month and the eleven before it, nothing future", () => {
    expect(isShareableMonth("2026-10", NOW)).toBe(true);
    expect(isShareableMonth("2025-11", NOW)).toBe(true);
    expect(isShareableMonth("2025-10", NOW)).toBe(false);
    expect(isShareableMonth("2026-11", NOW)).toBe(false);
    expect(firstMonthCounted(NOW)).toBe("2025-11-01");
    expect(firstMonthCounted(new Date("2026-01-05T00:00:00Z"))).toBe("2025-02-01");
  });
});
