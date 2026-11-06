import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
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
} from "../src/index.js";
import { checkTurn, turnPrompt } from "../src/interview/read-turn.js";
import { FakeModel } from "./model-fakes.js";

/** One model call reads a message with the chat so far; code checks every value and the interview decides. */

const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES, today: "2026-11-06", modelQuestions: true } as never;
const context = { lang: "en", text: "my tv not working" } as const;
const reply = (fields: object) =>
  JSON.stringify({ kind: "need", trade: null, job_type: null, problem: false, ...fields });

describe("reading one message", () => {
  it("takes a trade, or work outside the trades in the owner's script", () => {
    expect(checkTurn(reply({ trade: "plumber", problem: true }), context)).toEqual({
      kind: "need",
      trade: "plumber",
      problem: true,
    });
    expect(checkTurn(reply({ job_type: "TV repair" }), context)).toEqual({ kind: "need", jobType: "TV repair" });
  });

  it("drops what it may not say: a trade not on the list, a label in another script, an invented number", () => {
    expect(checkTurn(reply({ trade: "tv_mechanic", job_type: "TV repair" }), context)).toEqual({
      kind: "need",
      jobType: "TV repair",
    });
    expect(checkTurn(reply({ job_type: "टीवी मरम्मत" }), context)).toEqual({ kind: "need" });
    expect(checkTurn(reply({ job_type: "repair 3 TVs" }), context)).toEqual({ kind: "need" });
  });

  it("gives no job for a hello, and nothing for a reply that is not the object asked for", () => {
    expect(checkTurn(reply({ kind: "greeting", job_type: "general inquiry" }), context)).toEqual({ kind: "greeting" });
    expect(checkTurn("I think it is a plumber", context)).toBeUndefined();
    expect(checkTurn('{"kind":"shouting"}', context)).toBeUndefined();
  });

  it("quotes the owner's words and what is known, and gives way when the model gives nothing", async () => {
    const prompt = turnPrompt({ ...context, work: "AC technician", question: "Where?", recent: ["my ac broke"] });
    for (const part of ['"my tv not working"', '"AC technician"', '"Where?"', '"my ac broke"'])
      expect(prompt).toContain(part);
    expect(await readTurn(new FakeModel(null), context)).toBeUndefined();
    expect(await readTurn(new FakeModel(reply({ trade: "maid" })), context)).toMatchObject({ trade: "maid" });
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
