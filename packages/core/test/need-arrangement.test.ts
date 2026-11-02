import { Arrangement, type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ADD_ADDRESS,
  CITY_RATES,
  chooseNeed,
  DayWord,
  DriverPick,
  draftDetails,
  EVERY_DAY,
  hearNeed,
  NeedSlot,
  type NeedState,
  needPrompt,
  startNeed,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";

/** Find's "how long" question (ADR 0046) and its "where" question with saved addresses (ADR 0045). */

const T = Trade.enum;
const A = Arrangement.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala"] },
  { key: "hsr_layout", names: ["HSR Layout"] },
];
const HOME = { id: "adr_01JC0000000000000000000001", label: "home", areaName: "Banashankari", area: "banashankari" };
const WORK = { id: "adr_01JC0000000000000000000002", label: "work", areaName: "HSR Layout", area: "hsr_layout" };
const config = (own: Lang = "en", addresses?: (typeof HOME)[]) => ({
  own,
  areas: AREAS,
  rates: CITY_RATES,
  today: "2026-11-02",
  ...(addresses ? { addresses: addresses as never } : {}),
});
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
const values = (s: NeedState) => needPrompt(s).choices?.map((c) => c.value);
/** Answers whatever is still asked (I don't know, today, ₹900) up to the readback. */
function toReadback(start: NeedState): NeedState {
  let s = start;
  for (let i = 0; i < 10 && s.slot !== NeedSlot.confirm; i++) {
    if (s.slot === NeedSlot.driver) s = chooseNeed(s, DriverPick.dontKnow);
    else if (s.slot === NeedSlot.when) s = chooseNeed(s, DayWord.today);
    else if (s.slot === NeedSlot.budget) s = hearNeed(s, "900");
    else break;
  }
  return s;
}

/** A maid asked for, her first question skipped: the "how long" question is next. */
const atArrangement = (own: Lang = "en", addresses?: (typeof HOME)[]) =>
  chooseNeed(chooseNeed(startNeed(config(own, addresses)), T.maid), Pick.skip);

describe("how long the work is for", () => {
  it("is asked for a maid after her first question, with a chip for each arrangement", () => {
    const s = atArrangement();
    expect(s.slot).toBe(NeedSlot.arrangement);
    expect(keys(s)).toEqual(["need.ask.arrangement"]);
    expect(values(s)).toEqual([A.hourly, A.visit, A.weekly, A.monthly]);
  });

  it("is never asked for an electrician", () => {
    const s = chooseNeed(chooseNeed(startNeed(config()), T.electrician), Pick.skip);
    expect(s.slot).toBe(NeedSlot.area);
  });

  it("asks the day for a few hours or one visit, and keeps every day for monthly work", () => {
    const hours = chooseNeed(atArrangement(), A.hourly);
    expect(hours.draft.arrangement).toBe(A.hourly);
    expect(hours.draft.day).toBeUndefined();
    const monthly = chooseNeed(atArrangement(), A.monthly);
    expect(monthly.draft.day).toBe(EVERY_DAY);
  });

  it("hears it said in English, Hindi and Kannada, and asks again for anything else", () => {
    expect(hearNeed(atArrangement(), "just for 3 hours").draft.arrangement).toBe(A.hourly);
    expect(hearNeed(atArrangement("hi"), "हफ़्ते में तीन दिन").draft.arrangement).toBe(A.weekly);
    expect(hearNeed(atArrangement("kn"), "ಪ್ರತಿ ತಿಂಗಳು").draft.arrangement).toBe(A.monthly);
    expect(hearNeed(atArrangement("hi"), "सिर्फ़ एक बार").draft.arrangement).toBe(A.visit);
    expect(hearNeed(atArrangement(), "whenever").slot).toBe(NeedSlot.arrangement);
  });

  it("goes with the request's details, and is read back", () => {
    const s = chooseNeed(atArrangement(), A.weekly);
    expect(draftDetails(s.draft).arrangement).toBe(A.weekly);
    const done = toReadback(chooseNeed(s, "hsr_layout"));
    expect(done.slot).toBe(NeedSlot.confirm);
    const back = needPrompt(done).lines.find((l) => l.key === "need.summary_arrangement");
    expect(back?.names).toEqual({ arrangement: ["arrangement.weekly"] });
  });

  it("says the budget is per hour for hourly work, and shows no monthly band beside it", () => {
    let s = chooseNeed(chooseNeed(atArrangement(), A.hourly), "hsr_layout");
    for (let i = 0; i < 3 && s.slot === NeedSlot.driver; i++) s = chooseNeed(s, DriverPick.dontKnow);
    if (s.slot === NeedSlot.when) s = chooseNeed(s, DayWord.today);
    expect(s.slot).toBe(NeedSlot.budget);
    expect(keys(s)).toEqual(["need.ask.budget", "need.budget_per.hour"]);
  });
});

describe("where the work is, from saved addresses", () => {
  it("offers each saved address, Add an address, then the pilot areas", () => {
    const s = chooseNeed(atArrangement("en", [HOME, WORK]), A.monthly);
    expect(s.slot).toBe(NeedSlot.area);
    expect(keys(s)).toEqual(["need.ask.address"]);
    expect(values(s)).toEqual([HOME.id, WORK.id, ADD_ADDRESS, "koramangala", "hsr_layout"]);
    expect(needPrompt(s).choices?.[0]).toEqual({
      value: HOME.id,
      key: "addr.chip",
      params: { label: "Home", area: "Banashankari" },
    });
  });

  it("takes a saved address's area and remembers which address, and names a locality as it is", () => {
    const s = chooseNeed(chooseNeed(atArrangement("en", [HOME]), A.monthly), HOME.id);
    expect(s.draft).toMatchObject({ area: "banashankari", areaName: "Banashankari", address: HOME.id });
    const done = toReadback(s);
    const summary = needPrompt(done).lines.find((l) => l.key === "need.summary");
    expect(summary?.params).toEqual({ area: "Banashankari" });
  });

  it("drops the address when a pilot area is picked instead, and Add an address leaves the question open", () => {
    const at = chooseNeed(atArrangement("en", [HOME]), A.monthly);
    expect(chooseNeed(at, ADD_ADDRESS)).toBe(at);
    const byArea = chooseNeed(chooseNeed(at, HOME.id), "change");
    expect(chooseNeed(at, "koramangala").draft.address).toBeUndefined();
    expect(byArea).toBeDefined();
  });

  it("asks by area alone when the phone keeps no addresses (a worker hiring)", () => {
    const s = chooseNeed(atArrangement(), A.monthly);
    expect(keys(s)).toEqual(["need.ask.area"]);
  });
});
