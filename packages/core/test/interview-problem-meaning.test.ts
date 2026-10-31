import { type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  hearNeed,
  NeedSlot,
  type NeedState,
  needPrompt,
  problemByMeaning,
  problemIndex,
  startNeed,
} from "../src/index.js";
import { BagOfWordsEmbedder, NoVectors } from "./embedder-fakes.js";

/** The kind of a repair job by meaning (ADR 0042), and the clarifying question never asked twice. */

const T = Trade.enum;
const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-10-31" });
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
const PROBLEM_QUESTION = "driver.ask.problem";
/** The skip chip's value, as the interview's card names it. */
const SKIP = "skip";

describe("problemByMeaning", () => {
  const index = problemIndex(new BagOfWordsEmbedder());

  it("names the kind within the trade, from a saying it knows", async () => {
    expect(await problemByMeaning(index, T.carpenter, "table leg is broken")).toBe("repair");
    expect(await problemByMeaning(index, T.plumber, "drain blocked")).toBe("blockage");
  });

  it("names nothing for words unlike any saying, a trade without kinds, or no model", async () => {
    expect(await problemByMeaning(index, T.carpenter, "zxqv plorth")).toBeUndefined();
    expect(await problemByMeaning(index, T.cook, "table leg is broken")).toBeUndefined();
    expect(await problemByMeaning(problemIndex(new NoVectors()), T.carpenter, "table leg is broken")).toBeUndefined();
  });
});

describe("the clarifying question, answered", () => {
  const toProblem = (words: string) => hearNeed(startNeed(config("en")), words);

  it("takes the kind a model heard, so the price questions do not ask it", () => {
    const asked = toProblem("need a carpenter in HSR tomorrow, up to 900");
    expect(asked.slot).toBe(NeedSlot.detail);
    const answered = hearNeed(asked, "one of the legs came off", false, { problemKind: "repair" });
    expect(answered.draft.drivers?.problem).toBe("repair");
    expect(keys(answered)).not.toContain(PROBLEM_QUESTION);
  });

  it("does not ask the kind again when the words answered but named none", () => {
    const asked = toProblem("need a carpenter in HSR tomorrow, up to 900");
    const answered = hearNeed(asked, "one of the legs came off");
    expect(answered.draft.detail).toBe("one of the legs came off");
    expect(answered.draft.notKnown).toContain("problem");
    expect(keys(answered)).not.toContain(PROBLEM_QUESTION);
  });

  it("does not ask the kind again after a skip either", () => {
    const asked = toProblem("need an electrician in HSR tomorrow, up to 700");
    const skipped = chooseNeed(asked, SKIP);
    expect(skipped.draft.detail).toBeNull();
    expect(skipped.draft.notKnown).toContain("problem");
    expect(keys(skipped)).not.toContain(PROBLEM_QUESTION);
    // The count is still asked, in the electrician's words.
    expect(keys(skipped)).toEqual(["driver.ask.points.electrician"]);
  });
});
