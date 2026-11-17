import { describe, expect, it } from "vitest";
import { CITY_RATES, hearNeed, type Line, NeedSlot, needPrompt, startNeed } from "../src/index.js";

/** Find's small print: what the interview understood when the work was named, and why it asks what it asks next. */

const config = {
  own: "en" as const,
  areas: [{ key: "hsr_layout", names: ["HSR Layout"] }],
  rates: CITY_RATES,
  today: "2026-10-29",
};
const COOK = "my cook took leave today so need some help in getting my dinner cooked for my family";
const aside = (lines: readonly Line[]) => lines.filter((l) => l.aside);

describe("the understood note", () => {
  it("says what it understood and why it asks, in small print never read aloud, over the question", () => {
    const s = hearNeed(startNeed(config), COOK);
    expect(s.slot).toBe(NeedSlot.detail);
    const lines = needPrompt(s).lines;
    expect(aside(lines)).toEqual([
      { key: "need.understood", names: { what: ["trade.cook", "when.today"] }, silent: true, aside: true },
      { key: "need.why.people", silent: true, aside: true },
    ]);
    expect(lines.at(-1)).toEqual({ key: "question.people" });
  });

  it("keeps the day the owner said for monthly work, where every day is only the default", () => {
    expect(hearNeed(startNeed(config), COOK).draft.day).toBe("today");
    const plain = hearNeed(startNeed(config), "need a cook");
    expect(plain.draft.day).toBe("daily");
    // The default is not something the owner said, so the note leaves it out.
    expect(aside(needPrompt(plain).lines)[0]).toMatchObject({ names: { what: ["trade.cook"] } });
  });

  it("gives the reason for whichever question comes next", () => {
    const s = hearNeed(startNeed(config), "bedroom fan not working, need an electrician tomorrow morning, up to 700");
    expect(s.slot).toBe(NeedSlot.area);
    expect(aside(needPrompt(s).lines).map((l) => l.key)).toEqual(["need.understood", "need.why.area"]);
  });

  it("is said once: the answer after it moves on without it", () => {
    const s = hearNeed(hearNeed(startNeed(config), COOK), "4");
    expect(s.slot).not.toBe(NeedSlot.detail);
    expect(aside(needPrompt(s).lines)).toEqual([]);
  });

  it("is not said before the work is known", () => {
    expect(aside(needPrompt(startNeed(config)).lines)).toEqual([]);
    expect(aside(needPrompt(hearNeed(startNeed(config), "hello there")).lines)).toEqual([]);
  });
});
