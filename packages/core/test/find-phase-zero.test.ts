import { describe, expect, it } from "vitest";
import {
  askingModel,
  CITY_RATES,
  chooseNeed,
  hearNeed,
  isGreeting,
  NeedPick,
  NeedSlot,
  type NeedState,
  needPrompt,
  priceContext,
  startNeed,
  withJobType,
  withPriceStep,
} from "../src/index.js";
import { pricePrompt } from "../src/interview/price-model.js";

/** What Find's first real tests found: the model asked out of turn, questions repeated, a hello, a dead end. */

const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const HOME = { id: "adr_01JC0000000000000000000001", label: "home", areaName: "Parappana Agrahara", area: "parappana" };
const OFFICE = {
  ...HOME,
  id: "adr_01JC0000000000000000000002",
  label: "work",
  areaName: "HSR Layout",
  area: "hsr_layout",
};
const config = (more: object = {}) =>
  ({ own: "en", areas: AREAS, rates: CITY_RATES, today: "2026-11-06", modelQuestions: true, ...more }) as never;
const AC = { trade: "ac_technician", problem: true } as const;
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);

describe("the model's price questions", () => {
  const job = (more?: object) => withJobType(startNeed(config(more)), "electronics repair", "my tv not working");

  it("are for work outside the trades: a trade job never waits on the model", () => {
    const at = hearNeed(startNeed(config({ addresses: [HOME] })), "my ac is not working", false, AC);
    expect(askingModel(at)).toBe(false);
    expect(askingModel(chooseNeed(at, HOME.id))).toBe(false);
  });

  it("are asked for when the price question is the one open", () => {
    expect(askingModel(job())).toBe(true);
  });

  it("read the owner's words, so the model does not ask what they said", () => {
    expect(pricePrompt(priceContext(job()))).toContain('"my tv not working"');
  });
});

describe("the address in use", () => {
  const at = (inUse: string, words: string) =>
    hearNeed(startNeed(config({ addresses: [HOME, OFFICE], inUse })), words, false, AC);

  it("is never taken unasked: where is still the owner's to say", () => {
    const s = at(HOME.id, "my ac is not working");
    expect(s.draft.address).toBeUndefined();
    expect(s.slot).toBe(NeedSlot.area);
  });

  it("is the first chip at the question", () => {
    const chips = needPrompt(at(OFFICE.id, "my ac is not working")).choices?.map((c) => c.value);
    expect(chips?.slice(0, 2)).toEqual([OFFICE.id, HOME.id]);
  });

  it("gives way to a place the owner names", () => {
    expect(at(HOME.id, "my ac is not working in HSR").draft.address).toBe(OFFICE.id);
  });
});

describe("a hello", () => {
  it.each(["hey", "Hi there", "namaste ji", "नमस्ते", "ನಮಸ್ಕಾರ", "good morning"])("%s is a greeting", (text) => {
    expect(isGreeting(text)).toBe(true);
  });

  it.each(["hi my tap is leaking", "hey I need a cook", "my tv not working"])("%s is a need", (text) => {
    expect(isGreeting(text)).toBe(false);
  });
});

describe("after a need outside the list", () => {
  const outside = () =>
    withPriceStep(withJobType(startNeed(config()), "electronics repair", "my tv not working"), { questions: [] });

  it("says so and offers the list, and tapping it opens the trades", () => {
    const s = outside();
    expect(s.slot).toBe(NeedSlot.outside);
    expect(needPrompt(s).choices).toEqual([{ value: NeedPick.list, key: "need.pick_work" }]);
    const next = chooseNeed(s, NeedPick.list);
    expect(next.slot).toBe(NeedSlot.trade);
    expect(next.draft.jobType).toBeUndefined();
  });

  it("takes new words as a new need", () => {
    const next = hearNeed(outside(), "my tap is leaking");
    expect(next.draft.trade).toBe("plumber");
  });

  it("takes a new job type from scratch, its questions open again", () => {
    const next = withJobType(outside(), "drone repair", "fix my drone");
    expect(next.draft).toMatchObject({ jobType: "drone repair", need: "fix my drone" });
    expect(askingModel(next)).toBe(true);
    expect(keys(next)).toEqual(["driver.thinking"]);
  });
});
