import { City, type EstimateRequest, type Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  askingModel,
  CITY_RATES,
  checkPriceStep,
  chooseNeed,
  DriverPick,
  driverAnswer,
  hearNeed,
  MAX_PRICE_QUESTIONS,
  NeedSlot,
  type NeedState,
  needPrompt,
  needRequest,
  startNeed,
  withJobType,
} from "../src/index.js";
import { questions, ScriptModel, think } from "./price-fakes.js";

/** ADR 0041 §2 and ADR 0058: which price questions are asked, by code for a trade and by one model call otherwise. */

const city = City.enum.bengaluru;
const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR", "एचएसआर", "ಎಚ್ಎಸ್ಆರ್"] }];
const config = (own: Lang, modelQuestions = false) => ({
  own,
  areas: AREAS,
  rates: CITY_RATES,
  today: "2026-10-29",
  modelQuestions,
});
/** The question's lines; the small print over it (what an answer gave) is `need-took`'s, tested there. */
const keys = (s: NeedState) =>
  needPrompt(s)
    .lines.filter((l) => !l.aside)
    .map((l) => l.key);
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

describe("with a model: a trade asks its fixed questions, and the model writes nothing", () => {
  const atQuestions = (text = VILLA, own: Lang = "en") => run(startNeed(config(own, true)), [text, "HSR"]);

  it("never calls the model, and fills the drivers from the catalog's questions", async () => {
    const model = new ScriptModel([]);
    let s = await think(atQuestions(), model);
    expect(keys(s)).toEqual(["driver.ask.paint_by"]);
    s = await think(chooseNeed(s, "driver:household"), model);
    expect(s.draft.drivers?.paint_by).toBe("household");
    expect(s.draft.modelAsk?.said).toHaveLength(1);
    expect(model.prompts).toEqual([]);
    expect(askingModel(s)).toBe(false);
  });

  it.each(["four", "चार", "4 people", "just me"])("does not ask a cook's people again after %s", (said) => {
    let s = hearNeed(hearNeed(startNeed(config("en", true)), "I need a cook"), said);
    const asked: string[] = [];
    while (s.slot !== NeedSlot.when && s.slot !== NeedSlot.budget && asked.length < 8) {
      const next = needPrompt(s).choices?.[0]?.value;
      if (s.slot === NeedSlot.driver) asked.push(keys(s)[0] ?? "");
      s = next ? chooseNeed(s, next) : hearNeed(s, "HSR");
    }
    expect(asked).not.toContain("driver.ask.people");
  });

  it("reads a count said in words at a price question", () => {
    expect(driverAnswer("painter", "rooms", "three")).toEqual({ value: 3 });
  });

  it("'I don't know' ends them", async () => {
    const s = await think(hearNeed(atQuestions(), "don't know"), new ScriptModel([]));
    expect(s.draft.priceDone).toBe(true);
    expect(s.draft.notKnown).toEqual(["paint_by"]);
  });
});

describe("with a model: work outside the trades takes one call for all its questions", () => {
  const JOB = "TV repair";
  const WORDS = "my tv is not working";
  const atQuestions = (own: Lang = "en") => withJobType(startNeed(config(own, true)), JOB, WORDS);
  const TWO = questions(
    { text: "How big is the TV?", label: "Screen size", choices: ["32 inch", "43 inch"] },
    { text: "Is it under warranty?", label: "Warranty" },
  );

  it("asks them in turn with no second call, and keeps each answer as a fact on the phone", async () => {
    const model = new ScriptModel([TWO]);
    let s = await think(atQuestions(), model);
    expect(needPrompt(s).lines[0]).toEqual({ key: "estimate.answer", params: { text: "How big is the TV?" } });
    expect(needPrompt(s).choices?.map((c) => c.value)).toEqual(["fact:0", "fact:1", DriverPick.dontKnow]);
    s = await think(chooseNeed(s, "fact:1"), model);
    expect(needPrompt(s).lines[0]).toEqual({ key: "estimate.answer", params: { text: "Is it under warranty?" } });
    s = await think(hearNeed(s, "yes, one more year"), model);
    expect(s.slot).toBe(NeedSlot.outside);
    expect(s.draft.priceDone).toBe(true);
    expect(s.draft.facts).toEqual([
      { label: "Screen size", value: "43 inch" },
      { label: "Warranty", value: "yes, one more year" },
    ]);
    expect(model.prompts).toHaveLength(1);
  });

  it("writes at most two, and a question twice in other words counts once", () => {
    const context = { lang: "en", jobType: JOB, words: WORDS } as const;
    const out = checkPriceStep(
      questions(
        { text: "Is it a window AC or a split AC?", label: "AC type" },
        { text: "Is the AC unit a window type or a split type?", label: "Type" },
        { text: "How many units need service?", label: "Units" },
        { text: "How old is it?", label: "Age" },
      ),
      context,
    );
    expect("questions" in out && out.questions.map((q) => q.fills)).toEqual([{ fact: "AC type" }, { fact: "Units" }]);
  });

  it("goes on with no questions when the model has none, or its reply cannot be used", async () => {
    const none = await think(atQuestions(), new ScriptModel([questions()]));
    expect(none.slot).toBe(NeedSlot.outside);
    const broken = await think(atQuestions(), new ScriptModel(["not json at all"]));
    expect(broken.slot).toBe(NeedSlot.outside);
    expect(broken.draft.modelAsk).toBeUndefined();
  });

  it("drops a question in another language than the owner's, or one about money", async () => {
    const english = await think(
      atQuestions("hi"),
      new ScriptModel([questions({ text: "How big is the TV?", label: "Size" })]),
    );
    expect(english.draft.modelAsk).toBeUndefined();
    const money = await think(
      atQuestions(),
      new ScriptModel([questions({ text: "What is your budget?", label: "Budget" })]),
    );
    expect(money.draft.modelAsk).toBeUndefined();
  });

  it("'I don't know' ends the rest of them", async () => {
    const s = hearNeed(await think(atQuestions(), new ScriptModel([TWO])), "don't know");
    expect(s.draft.priceDone).toBe(true);
    expect(s.slot).toBe(NeedSlot.outside);
  });
});
