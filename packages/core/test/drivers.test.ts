import { Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  detailsToDrivers,
  driverAnswer,
  driverSpread,
  driversIn,
  driversToDetails,
  jobRange,
  RATE_CARDS,
  typicalFactor,
} from "../src/index.js";

/** ADR 0041: the price maths, which drivers to ask, and reading drivers from the owner's words. */

const T = Trade.enum;
const VILLA_KNOWN = { rooms: 4, house_type: "villa", surface: "both", area_sqft: 3000, floors: 2 };

describe("ranking a job's unknown drivers", () => {
  it("puts who buys the paint first for a villa whose size and walls are known", () => {
    const spread = driverSpread(T.painter, VILLA_KNOWN);
    expect(spread.assumed).toEqual(["paint_by", "finish"]);
    expect(spread.widths.paint_by).toBeCloseTo(2.5);
    expect(spread.widths.finish).toBeCloseTo(1.5);
    expect(spread.typical).toBeCloseTo(6486);
  });

  it("asks the area first when only the trade is known, since it also stands for the bedrooms", () => {
    const ranked = driverSpread(T.painter, {}).assumed;
    expect(ranked[0]).toBe("area_sqft");
    expect(ranked.indexOf("area_sqft")).toBeLessThan(ranked.indexOf("rooms"));
  });

  it("puts meals first for a cook", () => {
    expect(driverSpread(T.cook, {}).assumed[0]).toBe("meals");
  });

  it("leaves out drivers that do not move the price: floors when only inside walls are painted", () => {
    expect(driverSpread(T.painter, { surface: "inside", area_sqft: 1000 }).assumed).not.toContain("floors");
  });

  it("widens the range for an unknown driver and narrows it once known", () => {
    const rate = RATE_CARDS.bengaluru?.entries.painter.range ?? { low: 1, typical: 1, high: 1 };
    const unknown = jobRange(rate, driverSpread(T.painter, VILLA_KNOWN));
    const known = jobRange(rate, driverSpread(T.painter, { ...VILLA_KNOWN, paint_by: "worker", finish: "plain" }));
    expect(unknown.high / unknown.low).toBeGreaterThan(known.high / known.low);
    expect(known.low).toBeGreaterThan(unknown.low);
  });

  it("turns a record's price into a per-unit rate with unknowns at their defaults", () => {
    expect(typicalFactor(T.cook, { meals: 2, people: 3 })).toBe(2);
    expect(typicalFactor(T.cook, { meals: 2, people: 4, days_week: 7 })).toBeCloseTo((2 * 7 * 1.08) / 6);
  });
});

describe("reading drivers from the owner's words", () => {
  const VILLA = { rooms: 4, house_type: "villa", surface: "both", floors: 2 };

  it.each([
    ["English", "4 BHK villa painting, outside too, 2 floors"],
    ["Hinglish", "4 bhk villa hai, bahar bhi paint karna hai, 2 floor"],
    ["Hindi", "4 बीएचके विला, अंदर और बाहर पेंट, 2 मंजिल"],
    ["Kannada", "4 bhk ವಿಲ್ಲಾ, ಒಳಗೂ ಹೊರಗೂ ಪೇಂಟ್, 2 ಮಹಡಿ"],
  ])("%s", (_, text) => {
    expect(driversIn(text, T.painter)).toMatchObject(VILLA);
  });

  it("reads square feet with commas, G+1 as two floors, and who buys the paint", () => {
    expect(driversIn("3,000 sq ft independent house, G+1, I will buy the paint", T.painter)).toEqual({
      area_sqft: 3000,
      floors: 2,
      house_type: "independent",
      paint_by: "household",
    });
  });

  it("reads a cook's meals, people and days a week", () => {
    expect(driversIn("cook for 4 people, 2 meals, 6 days a week", T.cook)).toEqual({
      people: 4,
      meals: 2,
      days_week: 6,
    });
    expect(driversIn("हफ्ते में 5 दिन, 3 लोग", T.cook)).toMatchObject({ days_week: 5, people: 3 });
  });

  it("reads a repair's problem and points, only among the trade's own problems", () => {
    expect(driversIn("3 switches not working", T.electrician)).toEqual({ problem: "switch", points: 3 });
    expect(driversIn("tap leaking", T.electrician)).toEqual({});
    expect(driversIn("नल टपक रहा है", T.plumber)).toEqual({ problem: "leak" });
  });

  it("answers a question with a bare number, a chip value, or 'I don't know' in any language", () => {
    expect(driverAnswer(T.painter, "area_sqft", "about 2500")).toEqual({ value: 2500 });
    expect(driverAnswer(T.painter, "surface", "both")).toEqual({ value: "both" });
    expect(driverAnswer(T.painter, "paint_by", "yes")).toEqual({ value: "household" });
    for (const text of ["I don't know", "पता नहीं", "ಗೊತ್ತಿಲ್ಲ", "pata nahi"])
      expect(driverAnswer(T.painter, "floors", text)).toEqual({ dontKnow: true });
    expect(driverAnswer(T.painter, "floors", "99")).toBeUndefined();
  });

  it("keeps drivers and details one set of facts", () => {
    const details = driversToDetails(T.painter, { paint_by: "household", floors: 2 });
    expect(details).toEqual({ labour_only: "yes", floors: "2" });
    expect(detailsToDrivers(T.painter, { ...details, rooms: "4 bhk" })).toEqual({
      paint_by: "household",
      floors: 2,
      rooms: 4,
    });
  });
});

describe("the community rate card", () => {
  it("gives every figure a source, and never invents one", () => {
    const card = RATE_CARDS.bengaluru;
    for (const trade of Trade.options) {
      const entry = card?.entries[trade];
      expect(entry?.sources.length).toBeGreaterThan(0);
      for (const s of entry?.sources ?? []) expect(s.name && s.issuer && s.date && s.url).toBeTruthy();
    }
    expect(card?.entries.painter.sources.map((s) => s.name)).toEqual(["GigSync seed, unverified"]);
    expect(card?.entries.painter.sources[0]?.url).toBe("to be confirmed");
  });
});
