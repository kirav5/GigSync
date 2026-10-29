import { DetailFlag, type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, chooseNeed, type NeedMemory, NeedPick, NeedSlot, needPrompt, startNeed } from "../src/index.js";
import { Pick } from "../src/interview/card.js";

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala"] },
  { key: "hsr_layout", names: ["HSR Layout"] },
];
const config = (own: Lang, remembered?: NeedMemory) => ({
  own,
  areas: AREAS,
  rates: CITY_RATES,
  today: "2026-10-29",
  ...(remembered ? { remembered } : {}),
});
const firstChoice = (s: ReturnType<typeof startNeed>) => needPrompt(s).choices?.[0];

describe("the Find chat offers what the agent remembers", () => {
  it("the remembered area comes first, in the owner's language, and a tap takes it", () => {
    const remembered = { area: "hsr_layout", facts: {} };
    const atArea = chooseNeed(startNeed(config("hi", remembered)), T.electrician);
    expect(atArea.slot).toBe(NeedSlot.detail);
    const s = chooseNeed(atArea, Pick.skip);
    expect(s.slot).toBe(NeedSlot.area);
    expect(firstChoice(s)).toEqual({ value: "hsr_layout", key: "memory.same_area", params: { area: "एचएसआर लेआउट" } });
    expect(chooseNeed(s, "hsr_layout").draft.area).toBe("hsr_layout");
  });

  it("an area the catalog no longer has is not offered", () => {
    const s = chooseNeed(chooseNeed(startNeed(config("en", { area: "gone", facts: {} })), T.electrician), Pick.skip);
    expect(firstChoice(s)?.key).toBe("area.koramangala");
  });

  it("a remembered answer to the trade's first question is a chip, and a tap answers with it", () => {
    const s = chooseNeed(startNeed(config("en", { facts: { rooms: "3 rooms, sweeping" } })), T.maid);
    expect(s.slot).toBe(NeedSlot.detail);
    expect(firstChoice(s)).toEqual({
      value: NeedPick.remembered,
      key: "memory.same_value",
      params: { value: "3 rooms, sweeping" },
    });
    expect(chooseNeed(s, NeedPick.remembered).draft.detail).toBe("3 rooms, sweeping");
  });

  it("a remembered count shows as given; a yes or no in the owner's language", () => {
    const s = chooseNeed(startNeed(config("kn", { facts: { people: "4" } })), T.cook);
    expect(firstChoice(s)?.params).toEqual({ value: "4" });
    const flag = chooseNeed(startNeed(config("hi", { facts: { rooms: DetailFlag.enum.no } })), T.maid);
    expect(firstChoice(flag)?.params).toEqual({ value: "नहीं" });
  });

  it("nothing remembered: the questions are as before, and a remembered tap does nothing", () => {
    const s = chooseNeed(startNeed(config("en")), T.maid);
    expect(firstChoice(s)?.key).toBe("iv.skip");
    expect(chooseNeed(s, NeedPick.remembered)).toBe(s);
  });

  it("never offers a budget", () => {
    let s = chooseNeed(startNeed(config("en", { area: "hsr_layout", facts: { rooms: "3" } })), T.maid);
    s = chooseNeed(chooseNeed(chooseNeed(s, NeedPick.remembered), "hsr_layout"), "today");
    expect(s.slot).toBe(NeedSlot.budget);
    expect(needPrompt(s).choices).toBeUndefined();
  });
});
