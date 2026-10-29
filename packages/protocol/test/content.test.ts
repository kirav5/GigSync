import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { City, CityGuide, GuideStatus } from "../src/index.js";

/** The guide the API serves, checked into the repo next to it. */
const GUIDE_FILE = new URL("../../../workers/api/content/bengaluru.json", import.meta.url);
const DRAFT_LABEL = "Draft from public sources. Not yet checked by a union.";
const guideJson = (): unknown => JSON.parse(readFileSync(GUIDE_FILE, "utf8"));

describe("city guide", () => {
  it("parses the checked-in Bengaluru guide, still a labelled draft", () => {
    const guide = CityGuide.parse(guideJson());
    expect(guide.city).toBe(City.enum.bengaluru);
    expect(guide.status).toBe(GuideStatus.enum.draft);
    expect(guide.label).toBe(DRAFT_LABEL);
    expect(guide.needs_checking.length).toBeGreaterThan(0);
    for (const s of guide.sections) expect(s.sources.length).toBeGreaterThan(0);
  });

  it("gives the cash plan a number for every cost that has one", () => {
    const guide = CityGuide.parse(guideJson());
    const priced = guide.costs.filter((c) => c.amount_paise !== undefined);
    expect(priced.length).toBeGreaterThan(0);
    for (const c of priced) expect(Number.isInteger(c.amount_paise)).toBe(true);
  });

  it("has unique section ids", () => {
    const ids = CityGuide.parse(guideJson()).sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refuses a section without sources and a city without a guide", () => {
    const guide = CityGuide.parse(guideJson());
    const [first] = guide.sections;
    const unsourced = { ...guide, sections: [{ ...first, sources: [] }] };
    expect(CityGuide.safeParse(unsourced).success).toBe(false);
    expect(CityGuide.safeParse({ ...guide, city: "mumbai" }).success).toBe(false);
  });

  it("refuses a negative or fractional amount", () => {
    const guide = CityGuide.parse(guideJson());
    const [cost] = guide.costs;
    for (const amount_paise of [-1, 1.5]) {
      expect(CityGuide.safeParse({ ...guide, costs: [{ ...cost, amount_paise }] }).success).toBe(false);
    }
  });
});
