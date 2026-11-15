import { Arrangement, City, type EstimateRequest, QuestionKey, TimeWindow, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  arrangementRates,
  CITY_RATES,
  choose,
  draftOf,
  estimateRequest,
  hear,
  type InterviewState,
  keepPrice,
  nearYouLine,
  prompt,
  Slot,
  start,
  withEstimate,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";
import { COOK_MONTH } from "./estimate-fixtures.js";

/** The price card (the design's "Your price"): arrangement, amount, days and part of the day in one answer. */

const A = Arrangement.enum;
const T = Trade.enum;
const W = TimeWindow.enum;
const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;
/** A maid at the price question: the work, no other work, her area and how far she goes. */
const atRate = (trade: string = T.maid): InterviewState => {
  const said = hear(start({ own: "en", areas: AREAS, rates: CITY_RATES }), trade);
  return ["Koramangala", "10"].reduce((s, a) => hear(s, a), choose(said, Pick.yes));
};

describe("the price card", () => {
  it("answers how the work is priced, the amount, the days and the part of the day at once", () => {
    const s = atRate();
    expect(s.slot).toBe(Slot.rate);
    const next = keepPrice(s, { arrangement: A.monthly, paise: 450_000, days: WEEKDAYS, window: W.morning });
    expect(next.slot).toBe(Slot.min);
    expect(next.notes).toEqual([{ key: "iv.got_rate", prices: { price: 450_000 } }]);
    const draft = draftOf(next);
    expect(draft.arrangements).toEqual([A.monthly]);
    expect(draft.rate_paise).toBe(450_000);
    expect(draft.terms).toEqual({ days: [...WEEKDAYS], windows: [W.morning] });
    expect(arrangementRates(draft)).toEqual([{ arrangement: A.monthly, rate_paise: 450_000 }]);
  });

  it("leaves every day and any part of the day unset, as a card always was", () => {
    const next = keepPrice(atRate(), { arrangement: A.hourly, paise: 20_000, days: [1, 2, 3, 4, 5, 6, 7] });
    expect(next.draft.terms).toEqual({});
    expect(next.draft.arrangements).toEqual([A.hourly]);
  });

  it("puts a part of the day in place of hours on the clock", () => {
    const s = { ...atRate(), draft: { ...atRate().draft, terms: { from: 9, to: 13 } } };
    expect(keepPrice(s, { paise: 450_000, days: [], window: W.evening }).draft.terms).toEqual({ windows: [W.evening] });
  });

  it("keeps the days when the amount is far outside the usual and asked back", () => {
    const asked = keepPrice(atRate(), { arrangement: A.monthly, paise: 9_000_000, days: [1], window: W.evening });
    expect(asked.slot).toBe(Slot.rate);
    expect(asked.pending).toBe(9_000_000);
    const kept = choose(asked, Pick.yes);
    expect(kept.slot).toBe(Slot.min);
    expect(kept.draft.terms).toEqual({ days: [1], windows: [W.evening] });
  });

  it("a segment changes the unit asked in, and the line near them follows the estimate for it", () => {
    const s = atRate();
    const hourly = choose(s, A.hourly);
    expect(hourly.slot).toBe(Slot.rate);
    expect(prompt(hourly).lines.at(-1)).toEqual({ key: "iv.ask.rate_hour" });
    const details = { [QuestionKey.enum.arrangement]: A.monthly };
    const found = {
      request: estimateRequest(City.enum.bengaluru, T.maid, details) as EstimateRequest,
      estimate: COOK_MONTH,
    };
    expect(nearYouLine(withEstimate(s, found))).toEqual({
      key: "iv.near_you",
      prices: { low: 1_000_000, high: 1_200_000 },
    });
    // An estimate for the month says nothing about an hour.
    expect(nearYouLine(withEstimate(hourly, found))).toBeUndefined();
  });

  it("offers no segment to work done one way, and a typed amount still answers", () => {
    const s = atRate(T.electrician);
    expect(choose(s, A.visit)).toBe(s);
    expect(hear(s, "600").draft.rate_paise).toBe(60_000);
    expect(prompt(s).lines.at(-1)).toEqual({ key: "iv.ask.rate_visit" });
  });
});
