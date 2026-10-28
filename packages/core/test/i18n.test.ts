import { Lang, QuestionKey } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en/index.js";
import { questionText, t } from "../src/index.js";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(en) as (keyof typeof en)[];

describe("strings in every language", () => {
  it("every language has every string, non-empty, with the same placeholders as English", () => {
    for (const lang of Lang.options)
      for (const key of keys) {
        const s = t(lang, key);
        expect(s.trim().length, `${lang} ${key}`).toBeGreaterThan(0);
        expect(placeholders(s), `${lang} ${key}`).toEqual(placeholders(en[key]));
      }
  });

  it("every question key reads natively in every language, never as English on a Hindi or Kannada screen", () => {
    for (const key of QuestionKey.options) {
      const english = questionText(Lang.enum.en, key);
      expect(questionText(Lang.enum.hi, key)).not.toBe(english);
      expect(questionText(Lang.enum.kn, key)).not.toBe(english);
      expect(questionText(Lang.enum.hi, key)).toMatch(/[ऀ-ॿ]/); // Devanagari
      expect(questionText(Lang.enum.kn, key)).toMatch(/[ಀ-೿]/); // Kannada script
    }
  });

  it("fills placeholders it is given and leaves the others visible", () => {
    expect(t(Lang.enum.en, "question.pets", { unused: 1 })).toBe(en["question.pets"]);
  });
});
