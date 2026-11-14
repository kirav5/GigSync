import { CITY_RATES, type Lang, NO_READER_WORK, type ReaderResult, Trade, TurnKind } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  chooseNeed,
  hearNeed,
  hintOf,
  kindValue,
  NeedPick,
  NeedSlot,
  type NeedState,
  needPrompt,
  READER_GUESS_MIN,
  READER_WORK_MIN,
  type ReaderLabels,
  readerResult,
  startNeed,
  t,
  turnFromReader,
} from "../src/index.js";

/**
 * "Is this for…?": when the phone's reader is unsure which work a message is for, its likeliest kinds are offered as
 * chips, with "Something else" to the list, where the chat used to say "Sorry" and end at the list.
 */

const T = Trade.enum;
const W = TurnKind.enum;
const UNSURE = READER_WORK_MIN - 0.2;
const LIKELY = READER_GUESS_MIN + 0.1;
const UNLIKELY = READER_GUESS_MIN / 2;
const BED = "bed ki ek taang toot gayi hai";
const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const config = (own: Lang = "en") => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-11-14" });

const unsure: ReaderResult = {
  turn: W.need,
  turn_confidence: 0.9,
  work: T.carpenter,
  work_confidence: UNSURE,
  guesses: [
    { work: T.carpenter, confidence: UNSURE },
    { work: "laundry", confidence: LIKELY },
    { work: NO_READER_WORK, confidence: LIKELY },
  ],
  spans: [],
};

/** The first message heard as `readFirst` hands it on when nothing else named the work. */
const heardFrom = (read: ReaderResult, own: Lang = "en"): NeedState =>
  hearNeed(startNeed(config(own)), BED, false, hintOf(turnFromReader(read, BED)));

const values = (s: NeedState) => (needPrompt(s).choices ?? []).map((c) => c.value);
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);

describe("the reader's guesses", () => {
  it("come with its reading, likeliest first, at most three", () => {
    const labels: ReaderLabels = {
      turns: TurnKind.options,
      works: [NO_READER_WORK, T.plumber, T.carpenter, "laundry", "not_a_kind_anymore"],
      tags: ["O"],
      no_question: "none",
      max_tokens: 96,
    };
    const outputs = { turn: [0, 1, 0, 0, 0], work: [0.1, 0.2, 0.3, 0.15, 0.25], tags: [[1]] };
    const read = readerResult("bed", ["▁bed"], outputs, labels);
    expect(read?.guesses?.map((g) => g.work)).toEqual([T.carpenter, T.plumber, "laundry"]);
  });

  it("are kept as kinds of work when it is unsure, leaving out none", () => {
    expect(turnFromReader(unsure, BED).guesses).toEqual([T.carpenter, "laundry"]);
  });

  it("are not kept when it is sure", () => {
    const sure = { ...unsure, work_confidence: READER_WORK_MIN + 0.1 };
    expect(turnFromReader(sure, BED)).toEqual({ kind: W.need, trade: T.carpenter });
  });
});

describe("Is this for…?", () => {
  it("asks about the guesses, with Something else, and no Sorry", () => {
    const s = heardFrom(unsure);
    expect(s.slot).toBe(NeedSlot.trade);
    expect(keys(s)).toEqual(["need.guess_ask"]);
    expect(values(s)).toEqual([T.carpenter, kindValue("laundry"), NeedPick.list]);
  });

  it("is worded in every language the app speaks", () => {
    for (const own of ["en", "hi", "kn"] as const) {
      const prompt = needPrompt(heardFrom(unsure, own));
      expect(prompt.hints).toContain(t(own, "need.guess_else"));
      if (own !== "en") expect(t(own, "need.guess_ask")).not.toBe(t("en", "need.guess_ask"));
    }
  });

  it("goes on as if the words had named the work when a guess is picked", () => {
    const s = chooseNeed(heardFrom(unsure), T.carpenter);
    expect(s.draft.trade).toBe(T.carpenter);
    expect(s.slot).not.toBe(NeedSlot.trade);
    expect(s.guesses).toBeUndefined();
    expect(s.understood).toBe(true);
  });

  it("opens the list on Something else", () => {
    const s = chooseNeed(heardFrom(unsure), NeedPick.list);
    expect(s.slot).toBe(NeedSlot.trade);
    expect(keys(s)).toEqual(["need.pick_group"]);
  });

  it("is not asked when nothing is likely enough: the question again, as before", () => {
    const none = { ...unsure, guesses: [{ work: T.plumber, confidence: UNLIKELY }] };
    expect(keys(heardFrom(none))).toEqual(["need.again", "need.pick_group"]);
  });

  it("leaves a confident reading as it was", () => {
    const sure = { ...unsure, work_confidence: READER_WORK_MIN + 0.1 };
    const s = hearNeed(startNeed(config()), BED, false, hintOf(turnFromReader(sure, BED)));
    expect(s.draft.trade).toBe(T.carpenter);
    expect(s.guesses).toBeUndefined();
    expect(keys(s)).not.toContain("need.guess_ask");
  });

  it("offers a worker's need only the trades on their card", () => {
    const to = { user: "usr_01JRAVI", name: "Ravi", trades: [T.carpenter, T.plumber] } as const;
    const s = hearNeed(startNeed(config(), { ...to, trades: [...to.trades] }), BED, false, {
      decided: true,
      guesses: ["laundry", T.plumber],
    });
    expect(values(s)).toEqual([T.plumber, NeedPick.list]);
  });
});
