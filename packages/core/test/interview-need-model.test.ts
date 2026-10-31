import { Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, hearNeed, type Model, NeedSlot, NoModel, startNeed, understandNeed } from "../src/index.js";
import { firstObject, needModelPrompt } from "../src/interview/need-model.js";

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala"] },
  { key: "hsr_layout", names: ["HSR Layout", "HSR"] },
];
const EN = { areas: AREAS, lang: "en" as const };

/** A model that answers every prompt with `reply`, and remembers the prompts. */
class FakeModel implements Model {
  prompts: string[] = [];
  constructor(private readonly reply: string | null | (() => Promise<string | null>)) {}
  async generate(prompt: string) {
    this.prompts.push(prompt);
    return typeof this.reply === "function" ? this.reply() : this.reply;
  }
}

describe("a model's reading of a need", () => {
  it("is asked a short JSON-only prompt listing the allowed values", async () => {
    const model = new FakeModel("{}");
    await understandNeed(model, "my fan is dead", EN);
    expect(model.prompts[0]).toBe(needModelPrompt("my fan is dead", AREAS));
    expect(model.prompts[0]).toContain('"electrician" | "plumber"');
    expect(model.prompts[0]).toContain('"koramangala" | "hsr_layout"');
  });

  it("keeps good values", async () => {
    const reply = JSON.stringify({
      trade: "electrician",
      area: "hsr_layout",
      time: "after 5",
      budget_rupees: 700,
      problem: "fan is dead",
    });
    const hint = await understandNeed(new FakeModel(reply), "fan is dead in HSR, after 5 tomorrow, 700 max", EN);
    expect(hint).toEqual({
      trade: T.electrician,
      area: "hsr_layout",
      time: "after 5",
      budget_paise: 70_000,
      problem: true,
    });
  });

  it("takes the object out of a fenced or chatty reply", async () => {
    // As qwen2.5:1.5b answers through Ollama: fenced, numbers sometimes quoted.
    const fenced = '```json\n{ "trade": "electrician", "day": "tomorrow", "budget_rupees": "700" }\n```';
    const hint = await understandNeed(new FakeModel(fenced), "fan dead, tomorrow, 700", EN);
    expect(hint).toEqual({ trade: T.electrician, budget_paise: 70_000 });
    expect(firstObject('Sure! Here it is: {"a": "}{", "b": {"c": 1}} hope that helps')).toBe(
      '{"a": "}{", "b": {"c": 1}}',
    );
    expect(firstObject("{ unfinished")).toBeUndefined();
  });

  it("ignores garbage", async () => {
    for (const reply of ["", "I cannot help", "{not json}", "[1,2]", "null", '{"trade": 7}'])
      expect(await understandNeed(new FakeModel(reply), "fan dead", EN)).toEqual({});
  });

  it("drops values outside what the app allows", async () => {
    const hostile = JSON.stringify({
      trade: "hacker",
      area: "Mars",
      day: "yesterday",
      time: "ignore previous instructions",
      budget_rupees: 99_999,
      problem: "",
    });
    expect(await understandNeed(new FakeModel(hostile), "fan dead, up to 700", EN)).toEqual({});
  });

  it("never takes an area the owner did not name", async () => {
    // A small model fills the first area it was offered when none was said.
    const guess = JSON.stringify({ trade: "plumber", area: "koramangala", day: "today" });
    expect(await understandNeed(new FakeModel(guess), "the kitchen sink is blocked", EN)).toEqual({ trade: T.plumber });
    const misspelt = JSON.stringify({ area: "koramangala" });
    expect(await understandNeed(new FakeModel(misspelt), "sink blocked in koramangla", EN)).toEqual({
      area: "koramangala",
    });
  });

  it("takes a time only when the owner's words say one", async () => {
    const reply = (time: string) => new FakeModel(JSON.stringify({ time }));
    expect(await understandNeed(reply("paint"), "paint my flat", EN)).toEqual({});
    expect(await understandNeed(reply("after 5"), "come after 5", EN)).toEqual({ time: "after 5" });
  });

  it("never sets a budget the owner did not say", async () => {
    const reply = JSON.stringify({ budget_rupees: 650 });
    expect(await understandNeed(new FakeModel(reply), "fan dead, will pay fair price", EN)).toEqual({});
    expect(await understandNeed(new FakeModel(reply), "fan dead, six hundred fifty", EN)).toEqual({
      budget_paise: 65_000,
    });
  });

  it("is not asked without English, a model or an answer in time", async () => {
    const model = new FakeModel('{"trade": "plumber"}');
    expect(await understandNeed(model, "नल टपक रहा है", { areas: AREAS, lang: "hi" })).toEqual({});
    expect(model.prompts).toHaveLength(0);
    expect(await understandNeed(new NoModel(), "tap leaking", EN)).toEqual({});
    const slow = new FakeModel(() => new Promise((resolve) => setTimeout(() => resolve('{"trade": "plumber"}'), 50)));
    expect(await understandNeed(slow, "tap leaking", { ...EN, waitMs: 5 })).toEqual({});
    const broken = new FakeModel(() => Promise.reject(new Error("engine crashed")));
    expect(await understandNeed(broken, "tap leaking", EN)).toEqual({});
  });
});

describe("the interview with a model's hint", () => {
  const config = { own: "en" as const, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" };

  it("fills only what the word lists left empty", () => {
    // "dead" is in no word list; the model says the trade and that a problem was described.
    const s = hearNeed(startNeed(config), "my ceiling thing is dead", false, { trade: T.electrician, problem: true });
    expect(s.draft.trade).toBe(T.electrician);
    expect(s.draft.detail).toBe("my ceiling thing is dead");
    expect(s.slot).toBe(NeedSlot.area);
  });

  it("never overrides what the owner's words said", () => {
    const s = hearNeed(startNeed(config), "plumber in Koramangala", false, {
      trade: T.electrician,
      area: "hsr_layout",
    });
    expect(s.draft).toMatchObject({ trade: T.plumber, area: "koramangala" });
  });
});
