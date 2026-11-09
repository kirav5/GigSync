import { WorkCategory } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { categoryNamed, checkSuggestion, readSkill, readWork, suggestPrompt, suggestWork, t } from "../src/index.js";
import { NONE_OF_THEM } from "../src/skills/same-work.js";
import { FakeModel } from "./model-fakes.js";

/** ADR 0059: a worker's own words filed under a trade or a kind of work, only on their say-so. */

const named = (work: string) => JSON.stringify({ work });

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

  it("reads a name on the list as that trade or kind of work, and none as null", () => {
    expect(checkSuggestion(named("Electrician"))).toEqual({ trade: "electrician" });
    expect(checkSuggestion(named("Water tank cleaning"))).toEqual({ category: "water_tank_cleaning" });
    expect(checkSuggestion(named(NONE_OF_THEM))).toBeNull();
    expect(checkSuggestion(named("Rocket repair"))).toBeNull();
  });

  it("gives nothing for anything malformed", () => {
    for (const reply of ["not json", '{"choice":3}', '{"work":3}']) expect(checkSuggestion(reply)).toBeUndefined();
  });

  it("names the kinds a small model confuses by what they cover", () => {
    expect(suggestPrompt("tank safai")).toContain(
      "- Water tank cleaning: cleaning drinking-water tanks and sumps; an aquarium is not one",
    );
    expect(suggestPrompt("tank safai")).toContain(`- ${NONE_OF_THEM}`);
  });

  it("gives nothing when the model has no answer, and the kind when it names one", async () => {
    expect(await suggestWork(new FakeModel(null), "TV mechanic")).toBeUndefined();
    expect(await suggestWork(new FakeModel(named("TV repair")), "TV mechanic")).toEqual({ category: "tv_repair" });
    expect(await readWork(new FakeModel(named(NONE_OF_THEM)), "kite flying")).toBeNull();
  });
});
