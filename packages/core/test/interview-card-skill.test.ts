import type { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, choose, edit, hear, prompt, Slot, start } from "../src/index.js";
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
    // ADR 0051: work of their own may be taken any way, so the card asks which, before the area.
    expect(s.slot).toBe(Slot.arrangements);
    expect(prompt(s).choices?.map((c) => c.value)).toEqual(["hourly", "visit", "weekly", "monthly", "yes"]);
    const taken = hear(s, "by the hour and by the month");
    expect(taken.draft.arrangements).toEqual(["hourly", "monthly"]);
    expect(taken.slot).toBe(Slot.area);
  });

  it("takes a trade by its words as before, dropping a skill said earlier", () => {
    const said = hear(start(config("hi")), "मैं दर्ज़ी हूँ");
    expect(said.draft.skills).toEqual([{ text: "दर्ज़ी", lang: "hi", category: "tailor" }]);
    const s = hear(edit(said, Slot.trade), "मैं खाना बनाती हूँ");
    expect(s.draft.trades).toEqual(["cook"]);
    expect(s.draft.skills).toBeUndefined();
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
