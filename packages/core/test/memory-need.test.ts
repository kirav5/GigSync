import { AnswerFromMemory, Arrangement, DetailFlag, type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ANY_TIME_PICK,
  CITY_RATES,
  chooseNeed,
  DriverPick,
  hearNeed,
  type NeedMemory,
  NeedSlot,
  type NeedState,
  needPrompt,
  startNeed,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";
import { MemoryPick } from "../src/interview/need-memory.js";

const T = Trade.enum;
const { ask, auto } = AnswerFromMemory.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala"] },
  { key: "hsr_layout", names: ["HSR Layout"] },
];
const fresh = (value: string) => ({ value, fresh: true });
const old = (value: string) => ({ value, fresh: false });
const config = (own: Lang, remembered?: NeedMemory) => ({
  own,
  areas: AREAS,
  rates: CITY_RATES,
  today: "2026-10-29",
  ...(remembered ? { remembered } : {}),
});
const start = (remembered?: NeedMemory, own: Lang = "en") => startNeed(config(own, remembered));
/** The question's lines, without the small print over it. */
const lines = (s: NeedState) => needPrompt(s).lines.filter((l) => !l.aside);
const choiceValues = (s: NeedState) => needPrompt(s).choices?.map((c) => c.value);

describe("Ask me first: the Find chat offers what the agent remembers", () => {
  it("asks 'From your last job … Use it?' for the first question, and Yes takes it", () => {
    const s = chooseNeed(start({ mode: ask, facts: { rooms: fresh("3 rooms, sweeping") } }), T.maid);
    expect(s.slot).toBe(NeedSlot.detail);
    expect(lines(s)).toEqual([
      { key: "memory.offer_detail", params: { value: "3 rooms, sweeping" }, names: { detail: ["detail.rooms"] } },
    ]);
    expect(choiceValues(s)).toEqual([MemoryPick.use, MemoryPick.own]);
    const taken = chooseNeed(s, MemoryPick.use);
    expect(taken.draft.detail).toBe("3 rooms, sweeping");
    // How long the work is for comes before the area, and memory has nothing for it (ADR 0046).
    expect(taken.slot).toBe(NeedSlot.arrangement);
    expect(chooseNeed(taken, Arrangement.enum.monthly).slot).toBe(NeedSlot.area);
  });

  it("Change asks the question as usual, and memory stays out of it", () => {
    const s = chooseNeed(chooseNeed(start({ mode: ask, facts: { rooms: fresh("3") } }), T.maid), MemoryPick.own);
    expect(s.slot).toBe(NeedSlot.detail);
    expect(lines(s)).toEqual([{ key: "question.rooms" }]);
    expect(choiceValues(s)).toEqual([Pick.skip]);
    expect(hearNeed(s, "2 rooms").draft.detail).toBe("2 rooms");
  });

  it("a yes or no said aloud answers the offer; other words answer the question", () => {
    const s = chooseNeed(start({ mode: ask, facts: { rooms: fresh("3") } }), T.maid);
    expect(hearNeed(s, "yes").draft.detail).toBe("3");
    expect(lines(hearNeed(s, "no"))).toEqual([{ key: "question.rooms" }]);
    expect(hearNeed(s, "4 rooms and the kitchen").draft.detail).toBe("4 rooms and the kitchen");
  });

  it("offers the area the same way, in the owner's language, only while the catalog still has it", () => {
    const remembered = { mode: ask, area: fresh("hsr_layout"), facts: {} };
    const atArea = chooseNeed(chooseNeed(start(remembered, "hi"), T.electrician), Pick.skip);
    expect(lines(atArea)).toEqual([{ key: "memory.offer_area", names: { area: ["area.hsr_layout"] } }]);
    expect(chooseNeed(atArea, MemoryPick.use).draft.area).toBe("hsr_layout");
    const gone = chooseNeed(chooseNeed(start({ mode: ask, area: fresh("gone"), facts: {} }), T.electrician), Pick.skip);
    expect(needPrompt(gone).choices?.[0]?.key).toBe("area.koramangala");
  });

  it("a yes or no fact is named in the reader's language", () => {
    const s = chooseNeed(start({ mode: ask, facts: { rooms: fresh(DetailFlag.enum.no) } }), T.maid);
    expect(lines(s)).toEqual([{ key: "memory.offer_detail", names: { value: ["flag.no"], detail: ["detail.rooms"] } }]);
  });

  it("a fact more than a year old is asked about as 'still right?', never used on its own", () => {
    const s = chooseNeed(start({ mode: ask, facts: { rooms: old("3") } }), T.maid);
    expect(lines(s)[0]?.key).toBe("memory.offer_detail_old");
    expect(s.draft.detail).toBeUndefined();
  });
});

describe("Answer for me: the agent fills in what it remembers, and says so", () => {
  const remembered = { mode: auto, area: fresh("hsr_layout"), facts: { rooms: fresh("3") } };

  it("fills the first question and the area, says each, and offers to change them", () => {
    const atArrangement = chooseNeed(start(remembered), T.maid);
    expect(atArrangement.draft.detail).toBe("3");
    expect(atArrangement.slot).toBe(NeedSlot.arrangement);
    expect(lines(atArrangement)[0]).toEqual({
      key: "memory.filled_detail",
      params: { value: "3" },
      names: { detail: ["detail.rooms"] },
    });
    expect(needPrompt(atArrangement).choices?.[0]).toEqual({
      value: MemoryPick.redoDetail,
      key: "memory.change_detail",
      params: { detail: "rooms" },
    });
    const s = chooseNeed(atArrangement, Arrangement.enum.monthly);
    expect(s.draft.area).toBe("hsr_layout");
    // A maid comes every day; what moves her price most (ADR 0041) is asked next, then the budget.
    expect(s.slot).toBe(NeedSlot.driver);
    expect(lines(s)[0]).toEqual({ key: "memory.filled_area", names: { area: ["area.hsr_layout"] } });
    expect(needPrompt(s).choices?.[0]).toEqual({ value: MemoryPick.redoArea, key: "memory.change_area" });
  });

  it("Change reopens that question, and the next answer goes on to what was missing", () => {
    const s = chooseNeed(chooseNeed(start(remembered), T.maid), MemoryPick.redoDetail);
    expect(s.slot).toBe(NeedSlot.detail);
    expect(lines(s)).toEqual([{ key: "question.rooms" }]);
    const answered = hearNeed(s, "2 rooms");
    expect(answered.draft.detail).toBe("2 rooms");
    expect(answered.slot).toBe(NeedSlot.arrangement);
    expect(needPrompt(answered).choices?.some((c) => c.value.startsWith("memory"))).toBe(false);
  });

  it("what the owner's own words said is kept; memory fills only what is missing", () => {
    const s = hearNeed(start(remembered), "maid for 2 rooms in Koramangala");
    expect(s.draft.detail).toContain("2");
    expect(s.draft.area).toBe("koramangala");
    expect(lines(s).some((l) => l.key === "memory.filled_detail" || l.key === "memory.filled_area")).toBe(false);
  });

  it("a fact more than a year old is asked fresh", () => {
    const s = chooseNeed(start({ mode: auto, facts: { rooms: old("3") } }), T.maid);
    expect(s.slot).toBe(NeedSlot.detail);
    expect(lines(s)).toEqual([{ key: "question.rooms" }]);
  });
});

describe("the Find chat without memory, and the budget", () => {
  it("nothing remembered: the questions are as before, and memory taps change nothing", () => {
    const s = chooseNeed(start(), T.maid);
    expect(choiceValues(s)).toEqual([Pick.skip]);
    for (const pick of Object.values(MemoryPick)) expect(chooseNeed(s, pick)).toBe(s);
  });

  it("never offers or fills a budget", () => {
    for (const mode of [ask, auto]) {
      let s = chooseNeed(start({ mode, area: fresh("hsr_layout"), facts: { rooms: fresh("3") } }), T.maid);
      if (mode === ask) s = chooseNeed(s, MemoryPick.use);
      s = chooseNeed(s, Arrangement.enum.monthly);
      if (mode === ask) s = chooseNeed(s, MemoryPick.use);
      s = chooseNeed(chooseNeed(s, DriverPick.dontKnow), ANY_TIME_PICK);
      expect(s.slot).toBe(NeedSlot.budget);
      expect(s.draft.budget_paise).toBeUndefined();
      expect(needPrompt(s).lines.some((l) => l.key.startsWith("memory.offer"))).toBe(false);
    }
  });
});
