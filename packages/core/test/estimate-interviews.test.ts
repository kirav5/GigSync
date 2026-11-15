import { Arrangement, City, type EstimateRequest, type Lang, QuestionKey, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  choose,
  chooseNeed,
  estimateRequest,
  type FoundEstimate,
  hear,
  hearNeed,
  type InterviewState,
  NeedSlot,
  type NeedState,
  nearYouLine,
  needEstimate,
  needPrompt,
  needRequest,
  needWithEstimate,
  prompt,
  Slot,
  start,
  startNeed,
  suggestedAmount,
  withEstimate,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";
import { COOK_MONTH, PAINT_2BHK } from "./estimate-fixtures.js";

const T = Trade.enum;
const city = City.enum.bengaluru;
const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const painterFound = (): FoundEstimate => ({
  request: estimateRequest(city, T.painter) as EstimateRequest,
  estimate: PAINT_2BHK,
});
/** The lines' keys, without the small print over a question (what an answer gave), which `need-took` tests. */
const keys = (lines: readonly { key: string; aside?: true }[]) => lines.filter((l) => !l.aside).map((l) => l.key);

describe("the estimate under the card's rate questions", () => {
  /** A cook's card is for monthly work here, so its estimate is asked for that arrangement (ADR 0051). */
  const MONTHLY = { arrangement: "monthly" };
  /** Past "Do you also do any of these?" (ADR 0061), asked right after the work, with Done. */
  const pastAlso = (s: InterviewState): InterviewState => {
    expect(s.slot).toBe(Slot.also);
    return choose(s, Pick.yes);
  };
  // How far they go comes right after the area (10 km here); its readback is left out, so the rate question is alone.
  const atRate = (trade: string, own: Lang = "en"): InterviewState => ({
    ...["Koramangala", "10"].reduce(
      (s, a) => hear(s, a),
      pastAlso(hear(start({ own, areas: AREAS, rates: CITY_RATES }), trade)),
    ),
    notes: [],
  });

  it("keeps the suggested amount when it is tapped under another arrangement's rate", () => {
    const draft = {
      trades: [T.cook],
      arrangements: [Arrangement.enum.visit, Arrangement.enum.monthly],
      area: "koramangala",
      rate_paise: 900000,
      limit_paise: 700000,
    };
    const asked = { ...start({ own: "en", areas: AREAS, rates: CITY_RATES }, draft), slot: Slot.more_rates };
    const details = { [QuestionKey.enum.arrangement]: Arrangement.enum.visit };
    const found = { request: estimateRequest(city, T.cook, details) as EstimateRequest, estimate: COOK_MONTH };
    const s = choose(withEstimate(asked, found), "suggested");
    expect(s.draft.other_rates?.visit).toBe(1_100_000);
  });

  it("puts one line under the price card, the range near them, and keeps the chat to the question", () => {
    const s = withEstimate(atRate("painter"), painterFound());
    expect(keys(prompt(s).lines)).toEqual(["iv.ask.rate_visit"]);
    expect(prompt(s).choices).toBeUndefined();
    expect(nearYouLine(s)).toEqual({ key: "iv.near_you", prices: { low: 1_400_000, high: 1_800_000 } });
    // The card opens at the amount suggested; the lowest card at the least suggested.
    expect(suggestedAmount(s, false)).toBe(1_600_000);
    expect(suggestedAmount(s, true)).toBe(1_400_000);
    expect(hear(s, "15000").draft.rate_paise).toBe(1_500_000);
  });

  it("the lowest question is one line too, private, answered with the card's amount", () => {
    const found = { request: estimateRequest(city, T.cook, MONTHLY) as EstimateRequest, estimate: COOK_MONTH };
    const min = hear(withEstimate(atRate("cook"), found), "11000");
    expect(keys(prompt(min).lines)).toEqual(["iv.got_rate", "iv.ask.min"]);
    expect(prompt(min).secret).toBe(true);
    expect(choose(min, "950000").draft.limit_paise).toBe(950_000);
  });

  it("an estimate for another trade is ignored: no line near them", () => {
    const s = withEstimate(atRate("cook"), painterFound());
    expect(nearYouLine(s)).toBeUndefined();
    expect(choose(s, Pick.suggested)).toBe(s);
  });
});

describe("the estimate beside the household's budget", () => {
  const config = { own: "en" as const, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" };
  const atBudget = (): NeedState =>
    ["paint my 2BHK", "Koramangala", "don't know", "tomorrow 10 am"].reduce(
      (s, a) => hearNeed(s, a),
      startNeed(config),
    );

  it("asks for the job the household described, rooms from their own sentence", () => {
    const s = atBudget();
    expect(s.slot).toBe(NeedSlot.budget);
    expect(needRequest(city, s.draft)).toEqual({
      city,
      area: "koramangala",
      trade: T.painter,
      scope: { rooms: "bhk2", labour_only: "yes" },
      // ADR 0041: the drivers known, after "don't know" ended the questions (who buys the paint is assumed).
      drivers: { rooms: 2 },
    });
  });

  it("shows the range with what it rests on and suggests a budget, which a tap uses and is not read back aloud", () => {
    const s = needWithEstimate(atBudget(), {
      request: needRequest(city, atBudget().draft) as EstimateRequest,
      estimate: PAINT_2BHK,
    });
    const p = needPrompt(s);
    expect(keys(p.lines)).toEqual([
      "need.ask.budget",
      "estimate.range_job",
      "driver.basis_line",
      "estimate.suggest_budget",
    ]);
    expect(p.secret).toBe(true);
    const used = chooseNeed(s, Pick.suggested);
    expect(used.draft.budget_paise).toBe(1_600_000);
    expect(used.notes).toEqual([{ key: "need.got_budget", prices: { price: 1_600_000 }, silent: true }]);
  });

  it("never fills the budget silently: without a tap the owner's own amount is what counts", () => {
    const s = needWithEstimate(atBudget(), {
      request: needRequest(city, atBudget().draft) as EstimateRequest,
      estimate: PAINT_2BHK,
    });
    expect(s.draft.budget_paise).toBeUndefined();
    expect(hearNeed(s, "12000").draft.budget_paise).toBe(1_200_000);
  });

  it("an estimate for another job (a changed trade or rooms) is not shown; the city band or nothing is", () => {
    const stale = needWithEstimate(atBudget(), painterFound());
    const changed = { ...stale, draft: { ...stale.draft, seen: { rooms: "3 rooms" }, detail: "3 rooms" } };
    expect(needEstimate(changed)).toBeUndefined();
    expect(keys(needPrompt(changed).lines)).toEqual(["need.ask.budget"]);
    expect(chooseNeed(changed, Pick.suggested)).toBe(changed);
  });
});
