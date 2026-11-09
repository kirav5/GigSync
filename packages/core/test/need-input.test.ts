import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chipsOnlyNeed,
  chooseNeed,
  hearNeed,
  NeedInput,
  NeedPick,
  NeedSlot,
  type NeedState,
  needInput,
  needPrompt,
  startNeed,
} from "../src/index.js";

/** With no model reading (ADR 0064), Find serves with chips: no sentence is offered, and a number keeps a field. */

const AREA = "hsr_layout";
const AREAS = [{ key: AREA, names: ["HSR"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES, today: "2026-11-08" } as never;
const to = (trades: string[]) => ({ user: "u1", name: "Ravi", trades }) as never;
const values = (s: NeedState) => needPrompt(s).choices?.map((c) => c.value) ?? [];
const lines = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
/** A need for `trade`, picked from the list as it is with no model. */
const picked = (trade: string) => chooseNeed(chipsOnlyNeed(startNeed(config)), trade);
/** The same need at another question. */
const at = (s: NeedState, slot: NeedSlot): NeedState => ({ ...s, slot });
const without = (s: NeedState) => needInput(s, false);

describe("what a question takes", () => {
  it("takes words at every question while a model reads", () => {
    const need = picked("electrician");
    for (const slot of Object.values(NeedSlot)) expect(needInput(at(need, slot), true)).toBe(NeedInput.words);
    expect(needInput(startNeed(config), true)).toBe(NeedInput.words);
  });

  it("takes only chips, with no model, wherever chips answer in full", () => {
    const need = picked("maid");
    const chipSlots = [NeedSlot.arrangement, NeedSlot.area, NeedSlot.when, NeedSlot.confirm, NeedSlot.nobody];
    for (const slot of chipSlots) {
      expect(without(at(need, slot))).toBe(NeedInput.chips);
      expect(values(at(need, slot)).length).toBeGreaterThan(0);
    }
    expect(without({ ...at(need, NeedSlot.confirm), changing: true })).toBe(NeedInput.chips);
    expect(without(startNeed(config))).toBe(NeedInput.chips);
  });

  it("keeps a number field for the budget and for a clarifying question that is a count", () => {
    expect(without(at(picked("plumber"), NeedSlot.budget))).toBe(NeedInput.number);
    expect(lines(picked("maid"))).toEqual(["question.rooms"]);
    expect(without(picked("maid"))).toBe(NeedInput.number);
    expect(lines(picked("cook"))).toEqual(["question.people"]);
    expect(without(picked("cook"))).toBe(NeedInput.number);
  });

  it("offers only Skip at a clarifying question that wants a description", () => {
    const need = picked("electrician");
    expect(lines(need)).toEqual(["question.problem"]);
    expect(without(need)).toBe(NeedInput.chips);
    expect(values(need)).toEqual(["skip"]);
    expect(chooseNeed(need, "skip").slot).toBe(NeedSlot.area);
  });

  it("keeps a number field for a price question that is a count, and chips alone for one of a few values", () => {
    const points = chooseNeed(chooseNeed(picked("electrician"), "skip"), AREA);
    expect(lines(points)).toEqual(["driver.ask.points.electrician"]);
    expect(without(points)).toBe(NeedInput.number);
    const paintBy = chooseNeed(hearNeed(picked("painter"), "3"), AREA);
    expect(lines(paintBy)).toEqual(["driver.ask.paint_by"]);
    expect(without(paintBy)).toBe(NeedInput.chips);
  });

  it("reads a typed number by code: a count stays a count, never a budget", () => {
    const rooms = hearNeed(picked("maid"), "3");
    expect(rooms.draft.detail).toBe("3");
    expect(rooms.draft.budget_paise).toBeUndefined();
    const points = hearNeed(chooseNeed(chooseNeed(picked("electrician"), "skip"), AREA), "4");
    expect(points.draft.drivers).toEqual({ points: 4 });
    const budget = hearNeed(at(picked("plumber"), NeedSlot.budget), "700");
    expect(budget.draft.budget_paise).toBe(70_000);
  });

  it("offers nothing while a search runs or the workers found are on screen", () => {
    const need = picked("plumber");
    expect(without(at(need, NeedSlot.done))).toBe(NeedInput.chips);
    expect(without(at(need, NeedSlot.found))).toBe(NeedInput.chips);
  });

  it("still takes words at a question no chip can answer, so the chat never stands still", () => {
    const skills = [
      { key: "s1", text: "TV repair" },
      { key: "s2", text: "Fridge repair" },
    ];
    const need = chipsOnlyNeed(startNeed(config, { user: "u1", name: "Ravi", trades: [], skills } as never));
    expect(need.slot).toBe(NeedSlot.trade);
    expect(values(need)).toEqual([]);
    expect(without(need)).toBe(NeedInput.words);
  });
});

describe("the opening with no model", () => {
  it("shows the groups to pick from in place of the invitation to say it", () => {
    const opening = startNeed(config);
    expect(lines(opening)).toEqual(["need.start"]);
    expect(values(opening)).toEqual([NeedPick.list]);
    const list = chipsOnlyNeed(opening);
    expect(lines(list)).toEqual(["need.pick_group"]);
    expect(values(list).every((v) => v.startsWith("group:"))).toBe(true);
    expect(without(list)).toBe(NeedInput.chips);
  });

  it("changes nothing when asked again, or once the need has moved on", () => {
    const list = chipsOnlyNeed(startNeed(config));
    expect(chipsOnlyNeed(list)).toBe(list);
    const later = picked("plumber");
    expect(chipsOnlyNeed(later)).toBe(later);
    const editing = at(later, NeedSlot.trade);
    expect(chipsOnlyNeed(editing)).toBe(editing);
  });

  it("goes to the first open question when the need is for a worker of one trade", () => {
    const opening = startNeed(config, to(["plumber"]));
    expect(lines(opening)).toEqual(["need.start_to"]);
    const need = chipsOnlyNeed(opening);
    expect(need.slot).toBe(NeedSlot.detail);
    expect(need.draft.trade).toBe("plumber");
  });

  it("offers the trades of a worker who has several", () => {
    const need = chipsOnlyNeed(startNeed(config, to(["plumber", "electrician"])));
    expect(lines(need)).toEqual(["need.ask.trade"]);
    expect(values(need)).toEqual(["plumber", "electrician"]);
    expect(without(need)).toBe(NeedInput.chips);
  });
});
