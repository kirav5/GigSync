import type { EstimateRequest } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { assembleEstimate, legalFloorPaise } from "../src/estimates/assemble.js";
import { type WebBand, webBand } from "../src/estimates/compute.js";
import { marketSince } from "../src/estimates/market.js";
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
const onWeb = (w: WebBand) => ({ kind: "web" as const, web: w, readAt: NOW });
const onGigsync = (low: number, typical: number, high: number, area?: string) => ({
  kind: "gigsync" as const,
  market: { band: { low, typical, high }, jobs: 34, ...(area ? { area } : {}) },
});

describe("the assembled estimate", () => {
  it("rounds to ₹10, or ₹1 per sq ft", () => {
    const e = assembleEstimate(ELECTRICIAN, onWeb(web(44_449, 50_051, 61_990)), NOW);
    expect(e).toMatchObject({ low_paise: 44_000, typical_paise: 50_000, high_paise: 62_000, unit: "job" });
    const perSqft = { ...PAINTER, scope: { labour_only: "yes" } } as EstimateRequest;
    const s = assembleEstimate(perSqft, onWeb(web(1_249, 1_510, 1_890)), NOW);
    expect(s).toMatchObject({ low_paise: 1_200, typical_paise: 1_500, high_paise: 1_900, unit: "sqft" });
  });

  it("never shows a figure below the legal minimum, and says so", () => {
    expect(legalFloorPaise(COOK)).toBe(643_000);
    expect(legalFloorPaise(MAID)).toBe(350_000);
    const weekly = { ...MAID, scope: { rooms: "bhk2", frequency: "weekly" } } as EstimateRequest;
    expect(legalFloorPaise(weekly)).toBe(59_000);
    expect(legalFloorPaise(PAINTER)).toBeUndefined();
    const e = assembleEstimate(MAID, onWeb(web(300_000, 340_000, 450_000)), NOW);
    expect(e).toMatchObject({ low_paise: 350_000, typical_paise: 350_000, high_paise: 450_000 });
    expect(e?.basis).toMatchObject({ legal_minimum_paise: 350_000, floored: true });
    const above = assembleEstimate(COOK, onWeb(web(900_000, 1_000_000, 1_100_000)), NOW);
    expect(above?.basis).toMatchObject({ legal_minimum_paise: 643_000, floored: false });
  });

  it("says a GigSync range's jobs and area, with no web sources, dated now", () => {
    const e = assembleEstimate(COOK, onGigsync(1_049_000, 1_101_000, 1_249_000, "jayanagar"), NOW);
    expect(e).toMatchObject({ low_paise: 1_049_000, typical_paise: 1_101_000, high_paise: 1_249_000 });
    expect(e.basis).toEqual({
      kind: "gigsync",
      sources: [],
      gigsync_jobs: 34,
      area: "jayanagar",
      legal_minimum_paise: 643_000,
      floored: false,
    });
    expect(e.as_of).toBe(NOW.toISOString());
    expect(assembleEstimate(COOK, onGigsync(1, 2, 3), NOW).basis.area).toBeUndefined();
  });

  it("floors a GigSync range at the legal minimum like the web's", () => {
    const e = assembleEstimate(MAID, onGigsync(300_000, 340_000, 450_000), NOW);
    expect(e).toMatchObject({ low_paise: 350_000, typical_paise: 350_000, high_paise: 450_000 });
    expect(e.basis).toMatchObject({ kind: "gigsync", legal_minimum_paise: 350_000, floored: true });
  });
});

describe("the market window", () => {
  it("starts the same moment twelve calendar months back", () => {
    expect(marketSince(NOW).toISOString()).toBe("2025-10-29T10:00:00.000Z");
    expect(marketSince(new Date("2026-01-05T00:00:00Z")).toISOString()).toBe("2025-01-05T00:00:00.000Z");
  });
});
