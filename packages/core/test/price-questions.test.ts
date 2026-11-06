import { City, type EstimateRequest, type Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  DriverPick,
  hearNeed,
  MAX_PRICE_QUESTIONS,
  NeedSlot,
  type NeedState,
  needPrompt,
  needRequest,
  startNeed,
} from "../src/index.js";
import { ScriptModel, step, think } from "./price-fakes.js";

/** ADR 0041 §2: which price questions are asked, by code in lite mode and by the phone's model otherwise. */

const city = City.enum.bengaluru;
const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR", "एचएसआर", "ಎಚ್ಎಸ್ಆರ್"] }];
const config = (own: Lang, modelQuestions = false) => ({
  own,
  areas: AREAS,
  rates: CITY_RATES,
  today: "2026-10-29",
  modelQuestions,
});
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
const run = (s: NeedState, answers: readonly string[]) => answers.reduce((at, a) => hearNeed(at, a), s);
const VILLA = "4 BHK villa painting, outside too, 2 floors";

/** Every estimate request the flow's states would send, as the app fetches on each change: distinct and defined. */
const requestsOf = (states: readonly NeedState[]) => [
  ...new Set(
    states.flatMap((s) => {
      const r = needRequest(city, s.draft);
      return r ? [JSON.stringify(r)] : [];
    }),
  ),
];

describe("lite mode: the fixed driver questions", () => {
  it("asks what the villa's words left out, widest first, and sends one estimate request at the end", () => {
    const states = [startNeed(config("en"))];
    const push = (next: NeedState) => {
      states.push(next);
      return next;
    };
    let s = push(hearNeed(states[0] as NeedState, VILLA));
    s = push(hearNeed(s, "HSR"));
    expect(s.slot).toBe(NeedSlot.driver);
    expect(keys(s)).toEqual(["driver.ask.paint_by"]);
    expect(needPrompt(s).choices?.map((c) => c.value)).toEqual([
      "driver:worker",
      "driver:household",
      DriverPick.dontKnow,
    ]);
    s = push(chooseNeed(s, "driver:household"));
    expect(keys(s)).toEqual(["driver.ask.area_sqft"]);
    s = push(hearNeed(s, "about 3000"));
    expect(keys(s)).toEqual(["driver.ask.finish"]);
    s = push(hearNeed(s, "plain"));
    expect(s.slot).toBe(NeedSlot.when);
    expect(s.draft.askedDrivers).toBe(3);
    s = push(hearNeed(s, "tomorrow"));
    const requests = requestsOf(states);
    expect(requests).toHaveLength(1);
    const sent = JSON.parse(requests[0] as string) as EstimateRequest;
    expect(sent.drivers).toEqual({
      area_sqft: 3000,
      rooms: 4,
      surface: "both",
      floors: 2,
      house_type: "villa",
      paint_by: "household",
      finish: "plain",
    });
  });

  it("'I don't know' ends the questions; the driver is assumed, never asked again", () => {
    const s = run(startNeed(config("hi")), ["4 बीएचके विला, अंदर और बाहर पेंट", "एचएसआर"]);
    expect(s.slot).toBe(NeedSlot.driver);
    const after = hearNeed(s, "पता नहीं");
    expect(after.slot).toBe(NeedSlot.when);
    expect(after.draft.notKnown).toEqual(["paint_by"]);
    expect(needRequest(city, after.draft)?.drivers).not.toHaveProperty("paint_by");
  });

  it("asks at most five, however much is unknown", () => {
    let s = run(startNeed(config("en")), ["painter", "skip", "HSR"]);
    let asked = 0;
    while (s.slot === NeedSlot.driver) {
      const first = needPrompt(s).choices?.[0]?.value ?? "";
      s = chooseNeed(s, first);
      asked += 1;
    }
    expect(asked).toBeLessThanOrEqual(MAX_PRICE_QUESTIONS);
    expect(asked).toBeGreaterThan(0);
  });
});

describe("with a phone model: the model decides the questions", () => {
  const atQuestions = (text = VILLA, own: Lang = "en") => run(startNeed(config(own, true)), [text, "HSR"]);

  it("asks three questions at most, then the facts come with done", async () => {
    const model = new ScriptModel([
      step({ text: "Will you buy the paint yourself?", fills: "paint_by" }),
      step({ text: "Any damp patches or cracks?", fills: "Wall condition", choices: ["Fine", "Damp patches"] }),
      step({ text: "Plain paint or texture?", fills: "finish" }),
      step({ done: true, facts: [{ label: "Wall condition", value: "damp patches" }] }),
    ]);
    let s = await think(atQuestions(), model);
    expect(needPrompt(s).lines[0]).toEqual({
      key: "estimate.answer",
      params: { text: "Will you buy the paint yourself?" },
    });
    for (const answer of ["yes", "Damp patches", "plain"]) s = await think(hearNeed(s, answer), model);
    expect(s.draft.askedDrivers).toBe(MAX_PRICE_QUESTIONS);
    expect(s.slot).toBe(NeedSlot.when);
    // The facts stay on the phone for the owner's agent; the request carries the drivers only.
    expect(s.draft.facts).toEqual([{ label: "Wall condition", value: "damp patches" }]);
    expect(needRequest(city, s.draft)).not.toHaveProperty("facts");
    expect(needRequest(city, s.draft)?.drivers).toMatchObject({ paint_by: "household", finish: "plain" });
  });

  it("stops early when the model has enough", async () => {
    const model = new ScriptModel([
      step({ text: "Will you buy the paint yourself?", fills: "paint_by" }),
      step({ text: "Plain paint or texture?", fills: "finish" }),
      step({ done: true }),
    ]);
    let s = await think(atQuestions(), model);
    s = await think(hearNeed(s, "no"), model);
    s = await think(hearNeed(s, "texture"), model);
    expect(s.draft.askedDrivers).toBe(2);
    expect(s.slot).toBe(NeedSlot.when);
  });

  it("the safeguard asks the trade's top driver when the model never does", async () => {
    const model = new ScriptModel([
      step({ text: "How are the walls now?", fills: "Wall condition" }),
      step({ done: true }),
    ]);
    let s = await think(atQuestions("I want my house painted"), model);
    s = await think(hearNeed(s, "some cracks"), model);
    expect(s.slot).toBe(NeedSlot.driver);
    expect(keys(s)).toEqual(["driver.ask.area_sqft"]);
    s = await think(hearNeed(s, "1500"), model);
    expect(s.draft.drivers?.area_sqft).toBe(1500);
  });

  it("falls back to the fixed questions when the model's reply is malformed", async () => {
    const s = await think(atQuestions(), new ScriptModel(["not json at all"]));
    expect(s.draft.modelAsk).toBeUndefined();
    expect(keys(s)).toEqual(["driver.ask.paint_by"]);
  });

  it("drops a question in another language than the owner's, or one about money", async () => {
    const english = await think(
      atQuestions("4 बीएचके विला पेंट", "hi"),
      new ScriptModel([step({ text: "Who buys the paint?", fills: "paint_by" })]),
    );
    expect(english.draft.modelAsk).toBeUndefined();
    const money = await think(
      atQuestions(),
      new ScriptModel([step({ text: "What is your budget?", fills: "Budget" })]),
    );
    expect(money.draft.modelAsk).toBeUndefined();
  });

  it("'I don't know' ends the model's questions too", async () => {
    const model = new ScriptModel([step({ text: "Plain paint or texture?", fills: "finish" })]);
    const s = await think(hearNeed(await think(atQuestions(), model), "don't know"), model);
    expect(s.draft.priceDone).toBe(true);
    expect(s.draft.notKnown).toEqual(["finish"]);
    expect(model.prompts).toHaveLength(1);
  });
});
