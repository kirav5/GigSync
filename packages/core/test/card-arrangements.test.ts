import { Arrangement, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  arrangementMandates,
  arrangementRates,
  CITY_RATES,
  choose,
  draftOf,
  hear,
  type InterviewState,
  PILOT_AREA_CHOICES,
  priceArrangements,
  prompt,
  Slot,
  start,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";

/** The card interview's arrangements (ADR 0046): which work a maid or driver takes, and a rate for each. */

const A = Arrangement.enum;
const T = Trade.enum;
const fresh = (own: "en" | "hi" | "kn" = "en") => start({ own, areas: PILOT_AREA_CHOICES, rates: CITY_RATES });
const run = (s: InterviewState, answers: readonly string[]) => answers.reduce((x, a) => hear(x, a), s);
const keys = (s: InterviewState) => prompt(s).lines.map((l) => l.key);
/** Past "Do you also do any of these?" (ADR 0061), asked right after the work, with Done. */
const pastAlso = (s: InterviewState) => {
  expect(s.slot).toBe(Slot.also);
  return choose(s, Pick.yes);
};
const chosen = (trade: string, own: "en" | "hi" | "kn" = "en") => pastAlso(choose(fresh(own), trade));
/** The chips for several arrangements: an edit from the summary now, since the price card picks one on a first card. */
const arranging = (trade: string, own: "en" | "hi" | "kn" = "en"): InterviewState => ({
  ...chosen(trade, own),
  slot: Slot.arrangements,
});

describe("which work a maid takes", () => {
  it("is not asked on a first card: the price card offers them, as the work fits", () => {
    expect(chosen(T.maid).slot).toBe(Slot.area);
    expect(priceArrangements(chosen(T.maid).draft)).toEqual([A.visit, A.hourly, A.weekly, A.monthly]);
    expect(priceArrangements(chosen(T.cook).draft)).toEqual([A.visit, A.weekly, A.monthly]);
    expect(priceArrangements(chosen(T.electrician).draft)).toEqual([]);
  });

  it("is chips toggled and Done, when the owner changes it", () => {
    const s = arranging(T.maid);
    expect(prompt(s).choices?.map((c) => c.value)).toEqual([A.hourly, A.visit, A.weekly, A.monthly, Pick.yes]);
    expect(choose(s, Pick.yes).notes).toEqual([{ key: "iv.err_arrangements" }]);
    const both = choose(choose(choose(s, A.monthly), A.hourly), A.visit);
    const one = choose(both, A.visit);
    expect(one.draft.arrangements).toEqual([A.hourly, A.monthly]);
    expect(choose(one, Pick.yes).slot).toBe(Slot.area);
  });

  it("hears several said at once, in Hindi and Kannada too", () => {
    expect(hear(arranging(T.maid), "hourly and monthly").draft.arrangements).toEqual([A.hourly, A.monthly]);
    expect(hear(arranging(T.maid, "hi"), "घंटे के हिसाब से और महीने के हिसाब से").draft.arrangements).toEqual([
      A.hourly,
      A.monthly,
    ]);
    expect(hear(arranging(T.driver, "kn"), "ಒಂದು ಸಲ").draft.arrangements).toEqual([A.visit]);
  });
});

describe("a rate for each", () => {
  const picked = (arrangements: readonly string[]) =>
    run(arranging(T.maid), [arrangements.join(" and "), "Koramangala", "10"]);

  it("asks the main rate in its unit, the lowest, then each other rate, and reads them back", () => {
    const atRate = picked(["hourly", "weekly"]);
    expect(atRate.slot).toBe(Slot.rate);
    expect(keys(atRate)).toContain("iv.ask.rate_week");
    // The monthly city band is not shown under a weekly rate.
    expect(keys(atRate)).not.toContain("iv.band_month");
    const atMore = run(atRate, ["1200", "1000"]);
    expect(atMore.slot).toBe(Slot.more_rates);
    expect(keys(atMore)).toContain("iv.ask.rate_hour");
    const done = hear(atMore, "180");
    expect(done.slot).toBe(Slot.languages);
    const draft = draftOf(done);
    expect(arrangementRates(draft)).toEqual([
      { arrangement: A.hourly, rate_paise: 18000 },
      { arrangement: A.weekly, rate_paise: 120000 },
    ]);
  });

  it("keeps a monthly-only maid's card as every card was", () => {
    const atRate = picked(["monthly"]);
    expect(keys(atRate)).toContain("iv.ask.rate_month");
    const after = run(atRate, ["8000", "7000"]);
    expect(after.slot).toBe(Slot.languages);
    expect(arrangementRates(draftOf(after))).toEqual([{ arrangement: A.monthly, rate_paise: 800000 }]);
  });

  it("gives each other arrangement a lowest at the main one's share, rounded to the rupee", () => {
    const rates = [
      { arrangement: A.hourly, rate_paise: 18_050 },
      { arrangement: A.monthly, rate_paise: 800_000 },
    ];
    expect(arrangementMandates(rates, { opening_paise: 800_000, limit_paise: 600_000 }, A.monthly)).toEqual([
      { arrangement: A.hourly, rate: { opening_paise: 18_050, limit_paise: 13_500 } },
      { arrangement: A.monthly, rate: { opening_paise: 800_000, limit_paise: 600_000 } },
    ]);
  });
});
