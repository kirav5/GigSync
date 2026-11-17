import type { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, choose, edit, hear, priceArrangements, prompt, Slot, start } from "../src/index.js";
import { Pick } from "../src/interview/card.js";

const AREAS = [{ key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] }];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES });

describe("the card interview, for work outside the trades (ADR 0047)", () => {
  it("keeps the worker's own words for work that is no trade, and says so", () => {
    const said = hear(start(config("en")), "I am a tailor");
    expect(said.draft.skills).toEqual([{ text: "tailor", lang: "en", category: "tailor" }]);
    expect(said.draft.trades).toEqual([]);
    // ADR 0061: the other kinds in its group are offered next, under the words kept.
    expect(said.slot).toBe(Slot.also);
    expect(prompt(said).lines[0]).toEqual({ key: "iv.skill_kept", params: { skill: "tailor" } });
    const s = choose(said, Pick.yes);
    // ADR 0051: work of their own may be taken any way, so the price card offers all four; the area comes first.
    expect(s.slot).toBe(Slot.area);
    expect(priceArrangements(s.draft)).toEqual(["visit", "hourly", "weekly", "monthly"]);
  });

  it("takes a trade the model reads and the word lists agree on, dropping a skill said earlier", () => {
    const said = hear(start(config("hi")), "मैं दर्ज़ी हूँ");
    expect(said.draft.skills).toEqual([{ text: "दर्ज़ी", lang: "hi", category: "tailor" }]);
    const s = hear(edit(said, Slot.trade), "मैं खाना बनाती हूँ", false, { trade: "cook" });
    expect(s.draft.trades).toEqual(["cook"]);
    expect(s.draft.skills).toBeUndefined();
  });

  it("lets no word decide the work alone: a trade's word in the answer is asked about, or kept as said", () => {
    // "cleaning" is in no trade's name: with the model's reading it is confirmed, with none it stays their words.
    const asked = hear(start(config("en")), "overhead tank and sump cleaning", false, {
      category: "water_tank_cleaning",
    });
    expect(asked.kind).toEqual({ category: "water_tank_cleaning" });
    expect(asked.draft.trades).toEqual([]);
    const filed = choose(asked, Pick.yes);
    expect(filed.draft.skills).toEqual([
      { text: "overhead tank and sump cleaning", lang: "en", category: "water_tank_cleaning" },
    ]);
    const unread = hear(start(config("en")), "overhead tank and sump cleaning");
    expect(unread.draft.trades).toEqual([]);
    expect(unread.draft.skills).toEqual([{ text: "overhead tank and sump cleaning", lang: "en" }]);
  });

  it("files words a card cannot hold under the kind the model named, by the kind's own name", () => {
    const words = "mixer, iron and small appliance repair";
    const asked = hear(start(config("en")), words, false, { category: "small_appliance_repair" });
    const filed = choose(asked, Pick.yes);
    expect(filed.draft.skills).toEqual([
      { text: "Mixer and small appliance repair", lang: "en", category: "small_appliance_repair" },
    ]);
    // A no leaves nothing the card can hold, so the work is asked again; with no model, the words' problem is said.
    expect(prompt(choose(asked, Pick.no)).lines.map((l) => l.key)).toContain("iv.again.trade");
    expect(prompt(hear(start(config("en")), words)).lines.map((l) => l.key)).toContain("skill.err.words");
  });

  it("takes a trade named outright in a sentence, with or without a model", () => {
    expect(hear(start(config("en")), "change my work to plumber").draft.trades).toEqual(["plumber"]);
  });

  it("asks again, saying why, for words a card may not list", () => {
    const s = hear(start(config("en")), "call me on 98450 12345");
    expect(s.slot).toBe(Slot.trade);
    expect(prompt(s).lines[0]?.key).toBe("skill.err.characters");
  });

  it("reads the skill back in the worker's words", () => {
    const draft = { skills: [{ text: "Tailor", lang: "en" as const }], area: "koramangala" };
    const s = start(config("en"), { ...draft, rate_paise: 60000, limit_paise: 50000 });
    expect(s.slot).toBe(Slot.confirm);
    const summary = prompt(s).lines.find((l) => l.key === "iv.summary");
    expect(summary?.params?.trades).toBe("Tailor");
  });
});
