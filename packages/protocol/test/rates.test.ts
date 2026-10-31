import { describe, expect, it } from "vitest";
import { MAX_SCOPE_PERCENT, RateBand, RateCard } from "../src/index.js";

const band = { trade: "cook", low_paise: 750000, high_paise: 950000 };

describe("city rates", () => {
  it("a band defaults to no scope rules and refuses a low above its high", () => {
    expect(RateBand.parse(band).scope).toEqual([]);
    expect(RateBand.safeParse({ ...band, low_paise: 960000 }).success).toBe(false);
  });

  it("a scope rule is a flag or a count; a count says how many the band already covers", () => {
    const flag = { kind: "flag", key: "pets", percent: 15 };
    const count = { kind: "count", key: "people", percent: 10, included: 3 };
    expect(RateBand.parse({ ...band, scope: [flag, count] }).scope).toHaveLength(2);
    expect(RateBand.safeParse({ ...band, scope: [{ ...count, included: undefined }] }).success).toBe(false);
    expect(RateBand.safeParse({ ...band, scope: [{ ...flag, key: "colour" }] }).success).toBe(false);
    expect(RateBand.safeParse({ ...band, scope: [{ ...flag, percent: MAX_SCOPE_PERCENT + 1 }] }).success).toBe(false);
  });

  it("a card names its city and version", () => {
    expect(RateCard.safeParse({ city: "Bengaluru", version: 1, bands: [band] }).success).toBe(true);
    expect(RateCard.safeParse({ city: "Bengaluru", version: 0, bands: [] }).success).toBe(false);
  });
});
