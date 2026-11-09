import { type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type CardDraft,
  CITY_RATES,
  choose,
  draftOf,
  edit,
  fieldsFor,
  hear,
  type InterviewState,
  prompt,
  Slot,
  start,
} from "../src/index.js";

/** Changing a card the owner already has (ADR 0053 §7); the walks from a new card are in interview-card.test.ts. */

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] },
  { key: "hsr_layout", names: ["HSR Layout", "एचएसआर लेआउट", "ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್", "HSR", "ಎಚ್‌ಎಸ್‌ಆರ್"] },
  { key: "jayanagar", names: ["Jayanagar", "जयनगर", "ಜಯನಗರ"] },
];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES });
/** Answers in turn, typed unless `aloud`. */
const run = (state: InterviewState, answers: readonly string[], aloud = false) =>
  answers.reduce((s, answer) => hear(s, answer, aloud), state);
const keys = (state: InterviewState) => prompt(state).lines.map((l) => l.key);
const FULL: CardDraft = {
  trades: [T.cook],
  area: "koramangala",
  rate_paise: 900000,
  limit_paise: 750000,
  languages: ["hi"],
  ask_me: [],
  auto: false,
};

describe("changing a card the owner already has", () => {
  it("opens on the summary and what to change", () => {
    const s = start(config("hi"), FULL);
    expect(s.slot).toBe(Slot.confirm);
    const lines = keys(s);
    expect(lines[0]).toBe("iv.summary");
    expect(lines.at(-1)).toBe("iv.what_change");
    expect(lines).not.toContain("iv.start");
    expect(prompt(s).choices?.map((c) => c.value)).toEqual(fieldsFor(s));
  });

  it("changes one field and comes back to confirm", () => {
    const s = choose(start(config("hi"), FULL), Slot.area);
    expect(keys(s)).toEqual(["iv.ask.area"]);
    const back = hear(s, "जयनगर");
    expect(back.slot).toBe(Slot.confirm);
    expect(keys(back).at(-1)).toBe("iv.confirm");
    expect(draftOf(back)).toEqual({ ...FULL, area: "jayanagar" });
  });

  it("asks the minimum again when a new rate falls below it", () => {
    const s = run(edit(start(config("hi"), FULL), Slot.rate), ["सात हज़ार"]);
    expect(keys(s)).toEqual(["iv.got_rate", "iv.ask.min", "iv.legal_min"]);
    expect(draftOf(hear(s, "छह हज़ार"))).toMatchObject({ rate_paise: 700000, limit_paise: 600000 });
    expect(hear(s, "छह हज़ार").slot).toBe(Slot.confirm);
  });

  it("asks the new trade's ask-first question after changing the trade", () => {
    const electrician = { ...FULL, trades: [T.electrician], rate_paise: 50000, limit_paise: 40000 };
    const s = run(edit(start(config("hi"), electrician), Slot.trade), ["घर का काम"]);
    // A maid says which work she takes first (ADR 0046), then her rate for it, in that unit.
    expect(s.slot).toBe(Slot.arrangements);
    const atRate = hear(s, "महीने के हिसाब से");
    expect(atRate.slot).toBe(Slot.rate);
    expect(prompt(atRate).lines.some((l) => l.key === "iv.ask.rate_month")).toBe(true);
  });

  it("goes back to the summary when there is nothing to change", () => {
    const s = hear(start(config("hi"), FULL), "कुछ नहीं");
    expect(keys(s).at(-1)).toBe("iv.confirm");
  });

  it("jumps to a field named with a change word at confirm", () => {
    const atConfirm = hear(start(config("hi"), FULL), "नहीं");
    expect(hear(atConfirm, "रेट बदलो").slot).toBe(Slot.rate);
  });
});
