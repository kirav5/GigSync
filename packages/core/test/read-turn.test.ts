import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  categorySkill,
  chooseNeed,
  hearNeed,
  hintOf,
  NeedSlot,
  namesOtherWork,
  needPrompt,
  notHeard,
  offerSwitch,
  readTurn,
  startNeed,
  withNobody,
  withSkill,
  workOptions,
} from "../src/index.js";
import { checkTurn, turnPrompt } from "../src/interview/read-turn.js";
import { FakeModel } from "./model-fakes.js";

/** One model call reads a message with the chat so far; code checks every value and the interview decides. */

const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES, today: "2026-11-06", modelQuestions: true } as never;
const TV = { key: "tv mechanic", text: "TV mechanic", lang: "en", category: "tv_repair", workers: 2 } as const;
const AQUARIUM = { key: "aquarium cleaning", text: "Aquarium cleaning", lang: "en", workers: 1 } as const;
const options = workOptions([TV, AQUARIUM]);
const context = { lang: "en", text: "my tv not working", options } as const;
const reply = (fields: object) => JSON.stringify({ kind: "need", work: null, name: null, problem: false, ...fields });

describe("reading one message", () => {
  it("takes a trade, a kind of work or a listed skill by its name on the list", () => {
    expect(checkTurn(reply({ work: "Plumber", problem: true }), context)).toEqual({
      kind: "need",
      trade: "plumber",
      problem: true,
    });
    expect(checkTurn(reply({ work: "TV repair" }), context)).toEqual({
      kind: "need",
      category: "tv_repair",
    });
    expect(checkTurn(reply({ work: "Aquarium cleaning" }), context)).toEqual({ kind: "need", skill: AQUARIUM });
  });

  it("names work on no list in the owner's script", () => {
    expect(checkTurn(reply({ name: "drone repair" }), context)).toEqual({ kind: "need", jobType: "drone repair" });
  });

  it("drops what it may not say: a name off the list, a label in another script, an invented number", () => {
    expect(checkTurn(reply({ work: "Rocket repair", name: "drone repair" }), context)).toEqual({
      kind: "need",
      jobType: "drone repair",
    });
    expect(checkTurn(reply({ name: "ड्रोन मरम्मत" }), context)).toEqual({ kind: "need" });
    expect(checkTurn(reply({ name: "repair 3 drones" }), context)).toEqual({ kind: "need" });
  });

  it("lists the trades, the kinds of work, and only skills that fit no kind", () => {
    const prompt = turnPrompt(context);
    expect(prompt).toContain("AC technician: air conditioners only");
    expect(prompt).toContain("TV repair");
    expect(prompt).toContain("Aquarium cleaning");
    expect(prompt).not.toContain("TV mechanic");
  });

  it("gives no job for a hello, and nothing for a reply that is not the object asked for", () => {
    expect(checkTurn(reply({ kind: "greeting", name: "general inquiry" }), context)).toEqual({ kind: "greeting" });
    expect(checkTurn("I think it is a plumber", context)).toBeUndefined();
    expect(checkTurn('{"kind":"shouting"}', context)).toBeUndefined();
  });

  it("quotes the owner's words and what is known, and gives way when the model gives nothing", async () => {
    const prompt = turnPrompt({ ...context, work: "AC technician", question: "Where?", recent: ["my ac broke"] });
    for (const part of ['"my tv not working"', '"AC technician"', '"Where?"', '"my ac broke"'])
      expect(prompt).toContain(part);
    expect(await readTurn(new FakeModel(null), context)).toBeUndefined();
    expect(await readTurn(new FakeModel(reply({ work: "Maid" })), context)).toMatchObject({ trade: "maid" });
  });
});

describe("other work named part-way", () => {
  const ac = () =>
    hearNeed(startNeed(config), "my ac is not working", false, hintOf({ kind: "need", trade: "ac_technician" }));

  it("is not heard by the lists, and is offered, not guessed at", () => {
    const s = ac();
    const heard = hearNeed(s, "my tv not working");
    expect(notHeard(heard)).toBe(true);
    const read = { kind: "need", jobType: "TV repair" } as const;
    expect(namesOtherWork(s, read)).toBe(true);
    const asked = offerSwitch(s, read, "my tv not working");
    expect(needPrompt(asked).lines[0]).toMatchObject({ key: "need.switch_ask", params: { work: "TV repair" } });
  });

  it("is not more of the same work", () => {
    expect(namesOtherWork(ac(), { kind: "need", trade: "ac_technician" })).toBe(false);
  });

  it("goes back to the question on a no, and is marked on a yes for the app to open its chat", () => {
    const s = ac();
    const asked = offerSwitch(s, { kind: "need", trade: "cook" }, "I also need a cook");
    const no = hearNeed(asked, "no");
    expect(no.switching).toBeUndefined();
    expect(no.slot).toBe(s.slot);
    expect(chooseNeed(asked, "yes").switching).toMatchObject({ accepted: true, words: "I also need a cook" });
    expect(hearNeed(asked, "what?").switching?.accepted).toBeUndefined();
    expect(s.slot).toBe(NeedSlot.area);
  });
});

describe("work the owner names", () => {
  const onTv = withSkill(startNeed(config), { ...TV, text: "TV repair" }, "my tv not working");

  it("counts every wording of a kind of work, under its name in the owner's language", () => {
    const fridge = {
      key: "fridge man",
      text: "Fridge man",
      lang: "en",
      category: "fridge_repair",
      workers: 1,
    } as const;
    const list = [TV, { ...TV, key: "tv repair", text: "TV repair", workers: 3 }, fridge];
    expect(categorySkill("tv_repair", list, "hi")).toEqual({
      key: "tv mechanic",
      text: "टीवी मरम्मत",
      lang: "hi",
      category: "tv_repair",
      workers: 5,
    });
    expect(categorySkill("tailor", list, "en")).toBeUndefined();
  });

  it("is other work when its kind or skill differs, not when it is the same", () => {
    expect(namesOtherWork(onTv, { kind: "need", category: "tv_repair" })).toBe(false);
    expect(namesOtherWork(onTv, { kind: "need", category: "fridge_repair" })).toBe(true);
    expect(namesOtherWork(onTv, { kind: "need", skill: AQUARIUM })).toBe(true);
    expect(namesOtherWork(onTv, { kind: "need", jobType: "drone repair" })).toBe(true);
  });

  it("is named when the chat offers to switch to it", () => {
    const asked = offerSwitch(onTv, { kind: "need", category: "fridge_repair" }, "my fridge broke");
    expect(needPrompt(asked).lines[0]?.params).toEqual({ work: "Fridge repair" });
  });

  it("with no worker on a kind of work, says so with no price questions", () => {
    const s = withNobody(startNeed(config), "Swimming teacher", "I need a swimming coach");
    expect(s.slot).toBe(NeedSlot.outside);
    expect(needPrompt(s).lines[0]?.params).toEqual({ job: "Swimming teacher" });
  });
});
