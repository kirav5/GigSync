import type { BoardSkill, Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  draftDetails,
  hearNeed,
  listedSkill,
  NeedSlot,
  type NeedState,
  needPrompt,
  needToSend,
  needWords,
  readSkill,
  skillIndex,
  skillNamedIn,
  spokenSkill,
  startNeed,
  withSkill,
  workOf,
} from "../src/index.js";
import { BagOfWordsEmbedder } from "./embedder-fakes.js";

const AREAS = [{ key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] }];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-11-02" });
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
const listed = (text: string, workers = 1, lang: Lang = "en"): BoardSkill => ({
  key: text.toLowerCase(),
  text,
  lang,
  workers,
});
const LIST = [listed("Tailor", 3), listed("Garden work"), listed("मेहंदी", 2, "hi"), listed("Blouse stitching")];

describe("reading a skill a worker typed (ADR 0047)", () => {
  it("is the trade when the words are clearly one, with or without a word for work", () => {
    expect(readSkill("Bijli ka kaam", "hi")).toEqual({ trade: "electrician" });
    expect(readSkill("ಕುಕ್", "kn")).toEqual({ trade: "cook" });
    expect(readSkill("Plumbing work", "en")).toEqual({ trade: "plumber" });
  });

  it("keeps words that only contain a trade's word as the worker's own skill", () => {
    expect(readSkill("Car cleaning", "en")).toEqual({ skill: { text: "Car cleaning", lang: "en" } });
    expect(readSkill("  Painting   classes ", "en")).toEqual({ skill: { text: "Painting classes", lang: "en" } });
    expect(readSkill("ದರ್ಜಿ", "kn")).toEqual({ skill: { text: "ದರ್ಜಿ", lang: "kn" } });
  });

  it("says why words cannot be listed", () => {
    expect(readSkill("Call 98450 12345", "en")).toEqual({ problem: "characters" });
    expect(readSkill("Escort", "en")).toEqual({ problem: "blocked" });
  });

  it("drops the 'I am' around a spoken skill, and nothing in the middle", () => {
    expect(spokenSkill("I am a tailor")).toBe("tailor");
    expect(spokenSkill("मैं दर्ज़ी हूँ")).toBe("दर्ज़ी");
    expect(spokenSkill("I do mehendi")).toBe("mehendi");
    expect(spokenSkill("Garden work")).toBe("Garden work");
  });
});

describe("matching a household's words to the board's skills, on the phone", () => {
  it("finds a listed skill named in a sentence, or a letter or two off", () => {
    expect(skillNamedIn("I need a tailor tomorrow", LIST)?.key).toBe("tailor");
    expect(skillNamedIn("need a tailer", LIST)?.key).toBe("tailor");
    expect(skillNamedIn("शादी के लिए मेहंदी चाहिए", LIST)?.key).toBe("मेहंदी");
    expect(skillNamedIn("someone for garden work", LIST)?.key).toBe("garden work");
  });

  it("prefers the longer name, and finds nothing for work nobody lists", () => {
    expect(skillNamedIn("blouse stitching please", [...LIST, listed("Stitching", 9)])?.key).toBe("blouse stitching");
    expect(skillNamedIn("I need a dog walker", LIST)).toBeUndefined();
  });

  it("falls back to meaning on a phone with the embedding model, above the bar only", async () => {
    const list = [listed("Saree pleating")];
    const index = skillIndex(new BagOfWordsEmbedder(), list);
    expect((await listedSkill("Saree pleating", list, index))?.key).toBe("saree pleating");
    expect(await listedSkill("fix my roof", list, index)).toBeUndefined();
    expect(await listedSkill("fix my roof", list)).toBeUndefined();
  });
});

describe("Find for a listed skill", () => {
  const tailor = LIST[0] as BoardSkill;

  it("asks what the work is, where, when and the budget, with no estimate, then reads the skill back", () => {
    let s = withSkill(startNeed(config("en")), tailor, "tailor");
    expect(workOf(s.draft)).toBe("other");
    expect(s.slot).toBe(NeedSlot.detail);
    expect(keys(s)).toEqual(["need.skill_found", "question.job"]);
    s = hearNeed(s, "Stitch two blouses");
    // ADR 0051: work of the owner's own may be done any way; with no model to narrow it, all four are offered.
    expect(s.slot).toBe(NeedSlot.arrangement);
    expect(needPrompt(s).choices?.map((c) => c.value)).toEqual(["hourly", "visit", "weekly", "monthly"]);
    s = chooseNeed(s, "visit");
    expect(s.slot).toBe(NeedSlot.area);
    s = chooseNeed(chooseNeed(s, "koramangala"), "tomorrow");
    expect(s.slot).toBe(NeedSlot.budget);
    expect(keys(s)).toContain("need.skill_no_rate");
    s = hearNeed(s, "800");
    expect(s.slot).toBe(NeedSlot.confirm);
    const summary = needPrompt(s).lines.find((l) => l.key === "need.summary");
    expect(summary?.params?.trade).toBe("Tailor");
    expect(summary?.names?.trade).toBeUndefined();
    expect(needWords(s.draft, "en")).toBe("Tailor");
    expect(draftDetails(s.draft)).toEqual({ job: "Stitch two blouses", arrangement: "visit" });
  });

  it("takes a long first sentence as the answer to what the work is", () => {
    const s = withSkill(startNeed(config("en")), tailor, "I need a tailor to stitch two blouses, just once");
    // "Just once" said it is one visit, so how long is not asked either.
    expect(s.draft.arrangement).toBe("visit");
    expect(s.slot).toBe(NeedSlot.area);
    expect(s.draft.detail).toBe("I need a tailor to stitch two blouses, just once");
  });

  it("sends other work with the skill as listed, and never the budget", () => {
    const need = needToSend({
      trade: "other",
      skill: { text: tailor.text, lang: tailor.lang },
      need: "Tailor",
      day: "2026-11-03",
      label: "3 Nov",
      details: { job: "Stitch two blouses" },
      budget_paise: 80000,
      area: { lat: 12.93, lon: 77.62 },
    });
    expect(need).toMatchObject({ trade: "other", skill: { text: "Tailor", lang: "en" } });
    expect(JSON.stringify(need)).not.toContain("estimate");
  });

  it("starts at the skill when the need is addressed to a worker who lists only that", () => {
    const to = { user: "usr_01J0000000000000000000AAAA" as never, name: "Lakshmi", trades: [], skills: [tailor] };
    const s = startNeed(config("en"), to);
    expect(s.draft.skill?.key).toBe("tailor");
  });

  it("leaves a need that already has a trade alone", () => {
    const cook = chooseNeed(startNeed(config("en")), "cook");
    expect(withSkill(cook, tailor, "tailor")).toBe(cook);
  });
});
