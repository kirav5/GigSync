import { Lang, QuestionKey, SEED_SIGNER } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en/index.js";
import { CITY_RATES, proposeMandate, QUESTIONS, t, YES_NO_QUESTIONS } from "../src/index.js";

const band = (trade: string) => CITY_RATES.bands.find((b) => b.trade === trade);

describe("the rates the pilot app ships with", () => {
  it("is marked as a seed until a union signs it, and every low clears the statutory part-time pro-rata", () => {
    expect(CITY_RATES.signed_by).toBe(SEED_SIGNER);
    expect(band("cook")?.low_paise).toBeGreaterThanOrEqual(642000); // ₹790.32/day × 26 × 2.5/8
    expect(band("maid")?.low_paise).toBeGreaterThanOrEqual(349600); // ₹717.12/day × 26 × 1.5/8
  });

  it("every scope rule reads a question the trade's agent actually asks", () => {
    for (const b of CITY_RATES.bands) for (const rule of b.scope) expect(QUESTIONS[b.trade]).toContain(rule.key);
  });

  it("a maid's three rooms and no pets: one room beyond the two the band covers, 15% more", () => {
    const maid = band("maid");
    if (!maid) throw new Error("no maid band");
    const plan = proposeMandate({
      band: maid,
      details: { rooms: "3 rooms", pets: "no" },
      history: [],
      floor_paise: 500000,
    });
    expect(plan.mandate).toEqual({ opening_paise: 920000, limit_paise: 575000 });
  });

  it("yes-or-no questions are asked by some trade, and each language can say yes and no", () => {
    for (const key of YES_NO_QUESTIONS) expect(Object.values(QUESTIONS).flat()).toContain(key);
    for (const lang of Lang.options) expect(t(lang, "flag.yes")).not.toBe(t(lang, "flag.no"));
    expect(QuestionKey.options).toEqual(expect.arrayContaining([...YES_NO_QUESTIONS]));
  });
});

describe("screen strings", () => {
  it("every Hindi string with words is in Devanagari, every Kannada one in Kannada script", () => {
    const words = (s: string) => /\p{L}/u.test(s.replace(/\{\w+\}/g, ""));
    for (const key of (Object.keys(en) as (keyof typeof en)[]).filter((k) => words(en[k]))) {
      expect(t(Lang.enum.hi, key), key).toMatch(/[ऀ-ॿ]/);
      expect(t(Lang.enum.kn, key), key).toMatch(/[ಀ-೿]/);
    }
  });
});
