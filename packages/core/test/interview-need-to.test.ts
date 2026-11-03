import { type Lang, Trade, type UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  hearNeed,
  NeedSlot,
  type NeedState,
  type NeedTo,
  needPrompt,
  startNeed,
} from "../src/index.js";

/** A need addressed to one worker the household chose first: no search, only their trades, sent to them alone. */

const T = Trade.enum;
const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" });
const ravi = (trades: Trade[]): NeedTo => ({ user: "usr_01JRAVI" as UserId, name: "Ravi", trades });
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);

describe("a need addressed to one worker", () => {
  it("is for their one trade from the start, and asks for the need by their name, with no trade chips", () => {
    const s = startNeed(config("en"), ravi([T.electrician]));
    expect(s.draft.trade).toBe(T.electrician);
    expect(keys(s)).toEqual(["need.start_to"]);
    expect(needPrompt(s).lines[0]?.params).toEqual({ name: "Ravi" });
    expect(needPrompt(s).choices).toEqual([]);
    const next = hearNeed(s, "Bedroom fan not working, tomorrow, up to 700");
    expect(next.draft).toMatchObject({ trade: T.electrician, day: "tomorrow", budget_paise: 70_000 });
    expect(next.slot).toBe(NeedSlot.area);
  });

  it("offers only the trades on their card when there are several, and takes no other", () => {
    const s = startNeed(config("en"), ravi([T.electrician, T.plumber]));
    expect(needPrompt(s).choices?.map((c) => c.value)).toEqual([T.electrician, T.plumber]);
    expect(chooseNeed(s, T.cook).slot).toBe(NeedSlot.trade);
    expect(hearNeed(s, "need a cook for dinner").slot).toBe(NeedSlot.trade);
    expect(chooseNeed(s, T.plumber).draft.trade).toBe(T.plumber);
  });

  it("asks at the readback whether to ask them, and on yes says it is asking them, with no search", () => {
    const filled = ["Bedroom fan not working, tomorrow 10 am, up to 700", "HSR", "don't know"].reduce(
      (at, a) => hearNeed(at, a),
      startNeed(config("en"), ravi([T.electrician])),
    );
    expect(filled.slot).toBe(NeedSlot.confirm);
    expect(keys(filled).at(-1)).toBe("need.confirm_to");
    const yes = hearNeed(filled, "yes");
    expect(yes.slot).toBe(NeedSlot.done);
    expect(keys(yes)).toEqual(["need.asking_to"]);
  });
});
