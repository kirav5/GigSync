import { describe, expect, it } from "vitest";
import { CITY_RATES, chooseNeed, findEventOf, hearNeed, NeedPick, NeedSlot, startNeed } from "../src/index.js";

const AREAS = [{ key: "hsr_layout", names: ["HSR"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES, today: "2026-11-06" } as never;

describe("what a tap in Find counts as (ADR 0060)", () => {
  const start = startNeed(config);

  it("a trade picked from the list is a tap", () => {
    expect(findEventOf(chooseNeed(start, NeedPick.list), "plumber")).toBe("tapped");
  });

  it("Not this counts, at any question", () => {
    expect(findEventOf(hearNeed(start, "I need a plumber"), NeedPick.notThis)).toBe("not_this");
  });

  it("the work changed at the readback counts, and no other field does", () => {
    const changing = { ...start, slot: NeedSlot.confirm, changing: true };
    expect(findEventOf(changing, NeedSlot.trade)).toBe("changed");
    expect(findEventOf(changing, NeedSlot.area)).toBeUndefined();
  });

  it("nothing else does", () => {
    expect(findEventOf({ ...start, slot: NeedSlot.area }, "plumber")).toBeUndefined();
  });
});
