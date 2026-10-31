import { City, type Estimate, type EstimateRequest } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { estimateLines, GIGSYNC_SEED, KARNATAKA_MINIMUM, t } from "../src/index.js";

/** ADR 0041 §3 on screen: what a range rests on, how sure it is, and what drives its spread, in en/hi/kn. */

const request: EstimateRequest = { city: City.enum.bengaluru, trade: "cook", scope: { people: "3_4", meals: "2" } };
const estimate: Estimate = {
  low_paise: 900_000,
  typical_paise: 1_100_000,
  high_paise: 1_300_000,
  unit: "month",
  basis: {
    kind: "gigsync",
    sources: [],
    gigsync_jobs: 34,
    floored: false,
    blend: ["gigsync", "rate_card"],
    rate_card: { name: "rate card", sources: [GIGSYNC_SEED, KARNATAKA_MINIMUM] },
  },
  as_of: "2026-10-31T00:00:00.000Z",
  confidence: "medium",
  assumed: ["days_week"],
  spread_by: "days_week",
};

describe("an ADR 0041 estimate's lines", () => {
  it.each(["en", "hi", "kn"] as const)("in %s: the blend with the card's sources, the label and the spread", (lang) => {
    const lines = estimateLines(lang, { request, estimate });
    expect(lines.map((l) => l.key)).toEqual([
      "estimate.range_month",
      "driver.basis_line",
      "driver.confidence_line",
      "driver.spread",
      "driver.assumed",
    ]);
    const parts = String(lines[1]?.params?.parts);
    expect(parts).toContain(t(lang, "driver.basis.gigsync.other", { count: 34 }));
    expect(parts).toContain("GigSync seed, unverified + Karnataka minimum wages 2026");
    expect(lines[2]?.names).toEqual({ level: ["driver.confidence.medium"] });
    expect(lines[3]?.names).toEqual({ driver: ["driver.noun.days_week"] });
  });

  it("an estimate from before ADR 0041 shows as it did", () => {
    const { blend: _b, rate_card: _r, ...basis } = estimate.basis;
    const { confidence: _c, assumed: _a, spread_by: _s, ...old } = estimate;
    const keys = estimateLines("en", { request, estimate: { ...old, basis } }).map((l) => l.key);
    expect(keys).toEqual(["estimate.range_month", "estimate.jobs.other"]);
  });
});
