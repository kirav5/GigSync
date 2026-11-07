import { Trade, WorkCategory } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { categoryNamed, checkSuggestion, readSkill, suggestPrompt, suggestWork, t } from "../src/index.js";
import { FakeModel } from "./model-fakes.js";

/** ADR 0059: a worker's own words filed under a trade or a kind of work, only on their say-so. */

const at = (n: number) => JSON.stringify({ choice: n });
const firstCategory = Trade.options.length + 1;

describe("the kinds of work", () => {
  it("each has a name of its own, in every language", () => {
    for (const lang of ["en", "hi", "kn"] as const) {
      const names = WorkCategory.options.map((c) => t(lang, `category.${c}`));
      expect(new Set(names).size).toBe(WorkCategory.options.length);
    }
  });
});

describe("a skill that is the name of a kind of work", () => {
  it.each([
    ["Tailor", "en", "tailor"],
    ["tv repair", "en", "tv_repair"],
    ["दर्ज़ी", "hi", "tailor"],
    ["ದರ್ಜಿ", "kn", "tailor"],
  ] as const)("%s is filed with no question", (text, lang, category) => {
    expect(readSkill(text, lang)).toEqual({ skill: { text, lang, category } });
  });

  it("any other words stay the worker's own, with no kind", () => {
    expect(readSkill("TV mechanic", "en")).toEqual({ skill: { text: "TV mechanic", lang: "en" } });
    expect(categoryNamed("TV mechanic")).toBeUndefined();
  });

  it("a trade's own words are still that trade", () => {
    expect(readSkill("cook", "en")).toEqual({ trade: "cook" });
  });
});

describe("suggesting what a worker's words are", () => {
  it("offers the trades and the kinds of work, and quotes the words", () => {
    const prompt = suggestPrompt("AC mechanic");
    expect(prompt).toContain("AC technician");
    expect(prompt).toContain("TV repair");
    expect(prompt).toContain('"AC mechanic"');
  });

  it("reads a number as a place on the list", () => {
    expect(checkSuggestion(at(1))).toEqual({ trade: Trade.options[0] });
    expect(checkSuggestion(at(firstCategory))).toEqual({ category: WorkCategory.options[0] });
  });

  it("gives nothing for none, a number off the list, or anything malformed", () => {
    for (const reply of ['{"choice":null}', at(0), at(9999), "not json", '{"choice":"tv"}'])
      expect(checkSuggestion(reply)).toBeUndefined();
  });

  it("gives nothing when the model has no answer", async () => {
    expect(await suggestWork(new FakeModel(null), "TV mechanic")).toBeUndefined();
    expect(await suggestWork(new FakeModel(at(firstCategory)), "TV mechanic")).toEqual({ category: "tv_repair" });
  });
});
