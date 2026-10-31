import { City, type EstimateRequest, type Lang, Trade } from "@gigsync/protocol";
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
  needEstimate,
  needPrompt,
  needRequest,
  needWithEstimate,
  prompt,
  Slot,
  start,
  startNeed,
  withEstimate,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";
import { COOK_GIGSYNC, COOK_MONTH, PAINT_2BHK } from "./estimate-fixtures.js";

const T = Trade.enum;
const city = City.enum.bengaluru;
const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const painterFound = (): FoundEstimate => ({
  request: estimateRequest(city, T.painter) as EstimateRequest,
  estimate: PAINT_2BHK,
});
const keys = (lines: readonly { key: string }[]) => lines.map((l) => l.key);

describe("the estimate under the card's rate questions", () => {
  const atRate = (trade: string, own: Lang = "en"): InterviewState =>
    ["Koramangala"].reduce((s, a) => hear(s, a), hear(start({ own, areas: AREAS, rates: CITY_RATES }), trade));

  it("shows a painter the range with its scope, sources and date, and suggests opening at the typical figure", () => {
    const s = withEstimate(atRate("painter"), painterFound());
    const p = prompt(s);
    expect(keys(p.lines)).toEqual([
      "iv.ask.rate_visit",
      "estimate.range_job",
      "estimate.basis.other",
      "estimate.suggest_rate",
    ]);
    expect(p.lines[1]).toEqual({
      key: "estimate.range_job",
      names: { trade: ["trade.painter"], city: ["city.bengaluru"] },
      params: { scope: " (2 BHK, labour only)" },
      prices: { low: 1_400_000, high: 1_800_000 },
    });
    expect(p.lines[2]).toEqual({ key: "estimate.basis.other", params: { count: 5 }, dates: { date: "2026-11-02" } });
    expect(p.choices).toEqual([{ value: Pick.suggested, key: "estimate.use", params: { price: "₹16,000" } }]);
    expect(p.sources).toHaveLength(5);
  });

  it("the chip uses the suggestion; a worker's own amount is taken instead just the same", () => {
    const s = withEstimate(atRate("painter"), painterFound());
    const used = choose(s, Pick.suggested);
    expect(used.draft.rate_paise).toBe(1_600_000);
    expect(used.slot).toBe(Slot.min);
    // The least question: only the least suggested, not the range again.
    expect(keys(prompt(used).lines)).toEqual(["iv.got_rate", "iv.ask.min", "estimate.suggest_min"]);
    expect(choose(used, Pick.suggested).draft.limit_paise).toBe(1_400_000);
    expect(hear(s, "15000").draft.rate_paise).toBe(1_500_000);
  });

  it("puts the legal minimum under both questions for a cook, and nothing below it is suggested", () => {
    const found = { request: estimateRequest(city, T.cook) as EstimateRequest, estimate: COOK_MONTH };
    const s = withEstimate(atRate("cook"), found);
    expect(keys(prompt(s).lines)).toContain("estimate.legal_min");
    const min = choose(s, Pick.suggested);
    expect(keys(prompt(min).lines)).toEqual([
      "iv.got_rate",
      "iv.ask.min",
      "estimate.legal_min",
      "estimate.suggest_min",
    ]);
  });

  it("a range from GigSync's jobs says how many and where, with no sources to open", () => {
    const found = { request: estimateRequest(city, T.cook) as EstimateRequest, estimate: COOK_GIGSYNC };
    const lines = prompt(withEstimate(atRate("cook"), found)).lines;
    expect(lines.find((l) => l.key === "estimate.jobs.other")).toEqual({
      key: "estimate.jobs.other",
      params: { count: 34 },
      names: { place: ["area.jayanagar"] },
    });
    expect(lines.find((l) => l.key === "estimate.range_month")?.names?.city).toEqual(["area.jayanagar"]);
    expect(keys(lines)).not.toContain("estimate.basis.other");
  });

  it("a city-wide GigSync range names the city", () => {
    const { area: _, ...citywide } = COOK_GIGSYNC.basis;
    const found = {
      request: estimateRequest(city, T.cook) as EstimateRequest,
      estimate: { ...COOK_GIGSYNC, basis: citywide },
    };
    const line = prompt(withEstimate(atRate("cook"), found)).lines.find((l) => l.key === "estimate.jobs.other");
    expect(line?.names).toEqual({ place: ["city.bengaluru"] });
  });

  it("an estimate for another trade is ignored: the city band shows, and the chip does nothing", () => {
    const s = withEstimate(atRate("cook"), painterFound());
    expect(keys(prompt(s).lines)).toContain("iv.band_month");
    expect(prompt(s).choices).toBeUndefined();
    expect(choose(s, Pick.suggested)).toBe(s);
  });

  it("without an estimate the card asks as before", () => {
    expect(keys(prompt(atRate("cook")).lines)).toEqual([
      "iv.ask.rate_month",
      "iv.band_month",
      "iv.legal_min",
      "iv.band_seed",
    ]);
  });
});

describe("the estimate beside the household's budget", () => {
  const config = { own: "en" as const, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" };
  const atBudget = (): NeedState =>
    ["paint my 2BHK", "Koramangala", "tomorrow"].reduce((s, a) => hearNeed(s, a), startNeed(config));

  it("asks for the job the household described, rooms from their own sentence", () => {
    const s = atBudget();
    expect(s.slot).toBe(NeedSlot.budget);
    expect(needRequest(city, s.draft)).toEqual({
      city,
      area: "koramangala",
      trade: T.painter,
      scope: { rooms: "bhk2", labour_only: "yes" },
    });
  });

  it("shows the range with sources and suggests a budget, which a tap uses and is not read back aloud", () => {
    const s = needWithEstimate(atBudget(), {
      request: needRequest(city, atBudget().draft) as EstimateRequest,
      estimate: PAINT_2BHK,
    });
    const p = needPrompt(s);
    expect(keys(p.lines)).toEqual([
      "need.ask.budget",
      "estimate.range_job",
      "estimate.basis.other",
      "estimate.suggest_budget",
    ]);
    expect(p.secret).toBe(true);
    expect(p.sources).toHaveLength(5);
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
