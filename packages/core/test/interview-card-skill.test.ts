import type { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, edit, hear, prompt, Slot, start } from "../src/index.js";

const AREAS = [{ key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] }];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES });

describe("the card interview, for work outside the trades (ADR 0047)", () => {
  it("keeps the worker's own words for work that is no trade, and says so", () => {
    const s = hear(start(config("en")), "I am a tailor");
    expect(s.draft.skills).toEqual([{ text: "tailor", lang: "en" }]);
    expect(s.draft.trades).toEqual([]);
    expect(s.slot).toBe(Slot.area);
    expect(prompt(s).lines[0]).toEqual({ key: "iv.skill_kept", params: { skill: "tailor" } });
  });

  it("takes a trade by its words as before, dropping a skill said earlier", () => {
    const said = hear(start(config("hi")), "मैं दर्ज़ी हूँ");
    expect(said.draft.skills).toEqual([{ text: "दर्ज़ी", lang: "hi" }]);
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
