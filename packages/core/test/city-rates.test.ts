import { Lang, QuestionKey } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en.js";
import { CITY_RATES, proposeMandate, QUESTIONS, t, YES_NO_QUESTIONS } from "../src/index.js";

const band = (trade: string) => CITY_RATES.bands.find((b) => b.trade === trade);

describe("the rates the pilot app ships with", () => {
  it("every scope rule reads a question the trade's agent actually asks", () => {
    for (const b of CITY_RATES.bands) for (const rule of b.scope) expect(QUESTIONS[b.trade]).toContain(rule.key);
  });

  it("a maid's three rooms and no pets: one room beyond the two the band covers, 10% more", () => {
    const maid = band("maid");
    if (!maid) throw new Error("no maid band");
    const plan = proposeMandate({
      band: maid,
      details: { rooms: "3 rooms", pets: "no" },
      history: [],
      floor_paise: 500000,
    });
    expect(plan.mandate).toEqual({ opening_paise: 770000, limit_paise: 550000 });
  });

  it("yes-or-no questions are asked by some trade, and each language can say yes and no", () => {
    for (const key of YES_NO_QUESTIONS) expect(Object.values(QUESTIONS).flat()).toContain(key);
    for (const lang of Lang.options) expect(t(lang, "flag.yes")).not.toBe(t(lang, "flag.no"));
    expect(QuestionKey.options).toEqual(expect.arrayContaining([...YES_NO_QUESTIONS]));
  });
});

describe("screen strings", () => {
  it("every Hindi string is in Devanagari and every Kannada string in Kannada script", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(t(Lang.enum.hi, key), key).toMatch(/[ऀ-ॿ]/);
      expect(t(Lang.enum.kn, key), key).toMatch(/[ಀ-೿]/);
    }
  });
});
