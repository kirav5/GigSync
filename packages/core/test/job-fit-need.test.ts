import { Arrangement, type BoardSkill, type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ANY_TIME_PICK,
  boardArrangement,
  CITY_RATES,
  chooseNeed,
  DriverPick,
  EVERY_DAY,
  hearNeed,
  type Model,
  NeedSlot,
  type NeedState,
  needPrompt,
  startNeed,
  understandNeed,
  withSkill,
} from "../src/index.js";

/** Find asks by the job's nature (ADR 0051): only the arrangements, days and lines that fit the work. */

const T = Trade.enum;
const A = Arrangement.enum;
const AREAS = [{ key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] }];
const config = (own: Lang = "en") => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-11-03" });
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
const values = (s: NeedState) => needPrompt(s).choices?.map((c) => c.value);
const NANNY: BoardSkill = { text: "Nanny", lang: "en", workers: 2 } as BoardSkill;

/** A model that answers every prompt with `reply`. */
const modelSaying = (reply: string): Model => ({ generate: async () => reply });

/** Answers a cook's first question and stands at whatever comes next. */
const cookAsked = (own: Lang, words: string, people: string) =>
  hearNeed(hearNeed(startNeed(config(own)), words), people);

describe("work that is one visit by its nature", () => {
  it("never asks an electrician how long, and offers no Every day", () => {
    let s = hearNeed(startNeed(config()), "fan not working, need an electrician");
    s = chooseNeed(chooseNeed(s, "koramangala"), DriverPick.dontKnow);
    expect(s.draft.arrangement).toBeUndefined();
    expect(s.slot).toBe(NeedSlot.when);
    expect(values(s)).toEqual(["today", "tomorrow", "date"]);
    expect(values(s)).not.toContain(EVERY_DAY);
  });

  it("keeps Every day for work that may recur until its arrangement says otherwise", () => {
    const monthly = chooseNeed(cookAsked("en", "I need a cook", "4"), A.monthly);
    expect(monthly.draft.day).toBe(EVERY_DAY);
    const meal = chooseNeed(cookAsked("en", "I need a cook", "4"), A.visit);
    expect(meal.draft.day).toBeUndefined();
  });
});

describe("a cook, asked as a cook is hired", () => {
  it("offers one meal, some days a week or every month, never by the hour", () => {
    const s = cookAsked("en", "I need a cook", "4");
    expect(s.slot).toBe(NeedSlot.arrangement);
    expect(values(s)).toEqual([A.visit, A.weekly, A.monthly]);
    expect(needPrompt(s).choices?.[0]?.key).toBe("need.arr.meal");
    // A few hours is not how a cook is hired: the question stays, and a tap of it changes nothing.
    expect(hearNeed(s, "a few hours").slot).toBe(NeedSlot.arrangement);
    expect(chooseNeed(s, A.hourly)).toBe(s);
  });

  it("reads one meal or a party from the first sentence, in each language, and does not ask", () => {
    for (const [own, words, people] of [
      ["en", "need a cook for one meal on Saturday", "6"],
      ["hi", "पार्टी के लिए खाना बनाने वाली चाहिए", "6"],
      ["kn", "ಪಾರ್ಟಿಗೆ ಅಡುಗೆಯವರು ಬೇಕು", "6"],
    ] as const) {
      const s = cookAsked(own, words, people);
      expect(s.draft.trade).toBe(T.cook);
      expect(s.draft.arrangement).toBe(A.visit);
      expect(s.slot).not.toBe(NeedSlot.arrangement);
    }
  });

  it("says there is no going rate for one meal yet, rather than a monthly band", () => {
    let s = chooseNeed(cookAsked("en", "I need a cook", "4"), A.visit);
    s = chooseNeed(s, "koramangala");
    while (s.slot === NeedSlot.driver) s = chooseNeed(s, DriverPick.dontKnow);
    s = chooseNeed(s, "tomorrow");
    // The hour, once the day is known (ADR 0050 §1).
    s = chooseNeed(s, ANY_TIME_PICK);
    expect(s.slot).toBe(NeedSlot.budget);
    expect(keys(s)).toEqual(["need.ask.budget", "need.budget_per.visit", "need.skill_no_rate"]);
    expect(keys(s)).not.toContain("need.band_month");
  });

  it("searches the board for cooks who take that arrangement", () => {
    const s = chooseNeed(cookAsked("en", "I need a cook", "4"), A.weekly);
    expect(boardArrangement(s.draft)).toBe(A.weekly);
  });
});

describe("house help, by the hour", () => {
  it("takes hours said in the first sentence and asks the rest", () => {
    const s = hearNeed(startNeed(config()), "need a maid for 3 hours on Saturday in Koramangala");
    expect(s.draft.arrangement).toBe(A.hourly);
    expect(s.slot).not.toBe(NeedSlot.arrangement);
  });
});

describe("work outside the trades (ADR 0047)", () => {
  it("offers all four without a model, and the model's reading narrows them", () => {
    const plain = withSkill(startNeed(config()), NANNY, "nanny");
    const asked = hearNeed(plain, "Look after my two year old");
    expect(asked.slot).toBe(NeedSlot.arrangement);
    expect(values(asked)).toEqual(Arrangement.options);
    const narrowed: NeedState = { ...asked, draft: { ...asked.draft, fits: [A.hourly, A.monthly] } };
    expect(values(narrowed)).toEqual([A.hourly, A.monthly]);
    // Words may still name any arrangement the work allows.
    expect(hearNeed(narrowed, "some days a week").draft.arrangement).toBe(A.weekly);
  });

  it("never lets the model narrow a trade's reviewed list", () => {
    const s = cookAsked("en", "I need a cook", "4");
    const hinted: NeedState = { ...s, draft: { ...s.draft, fits: [A.monthly] } };
    expect(values(hinted)).toEqual([A.visit, A.weekly, A.monthly]);
  });

  it("leaves the arrangement out of the board search, which lists no skill worker's arrangements", () => {
    const s = chooseNeed(hearNeed(withSkill(startNeed(config()), NANNY, "nanny"), "Two year old"), A.hourly);
    expect(s.draft.arrangement).toBe(A.hourly);
    expect(boardArrangement(s.draft)).toBeUndefined();
  });
});

describe("the model's reading of how such work is hired", () => {
  const EN = { areas: AREAS, lang: "en" as const };

  it("keeps only arrangements, in their order, as a suggestion", async () => {
    const reply = '{"trade": null, "how_long": ["monthly", "daily", "hourly", "forever"]}';
    const hint = await understandNeed(modelSaying(reply), "someone to look after my baby", EN);
    expect(hint.fits).toEqual([A.hourly, A.monthly]);
  });

  it("drops a list that is not one, and keeps the rest of the reading", async () => {
    const reply = '{"trade": "plumber", "how_long": "monthly"}';
    const hint = await understandNeed(modelSaying(reply), "sink blocked", EN);
    expect(hint.fits).toBeUndefined();
    expect(hint.trade).toBe(T.plumber);
  });

  it("is kept on the draft from the first sentence it reads", () => {
    const s = hearNeed(startNeed(config()), "someone to look after my baby", false, { fits: [A.hourly] });
    expect(s.draft.fits).toEqual([A.hourly]);
  });
});
