import { type Lang, RateCard, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  hear,
  type InterviewState,
  LEGAL_MINIMUM,
  legalMonthly,
  nearYouLine,
  prompt,
  rateHint,
  rateNote,
  Slot,
  start,
  t,
} from "../src/index.js";

const T = Trade.enum;
const AREAS = [{ key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] }];
const config = (own: Lang, rates: RateCard = CITY_RATES) => ({ own, areas: AREAS, rates });
const run = (state: InterviewState, answers: readonly string[]) => answers.reduce((s, a) => hear(s, a), state);
/** "Do you also do any of these?" (ADR 0061) follows the work; "no" moves on with nothing added. */
const NO_OTHER_WORK = "no";
/** How far they go comes right after the area (10 km here); its readback is left out, so the question is alone. */
const atRate = (trade: string, rates?: RateCard): InterviewState => ({
  ...run(start(config("en", rates)), [trade, NO_OTHER_WORK, "Koramangala", "10"]),
  notes: [],
});
/** A union-signed card in another city, with a band for a per-visit trade. */
const MYSURU = RateCard.parse({
  city: "Mysuru",
  version: 1,
  signed_by: "Mysuru Domestic Workers Union",
  bands: [
    { trade: T.cook, low_paise: 600000, high_paise: 900000 },
    { trade: T.electrician, low_paise: 30000, high_paise: 60000 },
  ],
});

describe("the city's usual pay under the card's rate questions", () => {
  it("asks a cook's rate and least in one line each: the city's band stays off the chat (the price card has the going rate)", () => {
    const rate = atRate("cook");
    expect(prompt(rate).lines).toEqual([{ key: "iv.ask.rate_month" }]);
    // Without an estimate there is no "Near you" line: the city's band alone is not shown as one.
    expect(nearYouLine(rate)).toBeUndefined();
    const min = hear(rate, "9000");
    expect(min.slot).toBe(Slot.min);
    expect(prompt(min).secret).toBe(true);
    expect(prompt(min).lines.map((l) => l.key)).toEqual(["iv.got_rate", "iv.ask.min"]);
  });

  it("never reads the worker's typed lowest aloud", () => {
    const min = hear(atRate("maid"), "5000");
    expect(hear(min, "4000").notes).toEqual([{ key: "iv.got_min", prices: { price: 400000 }, silent: true }]);
  });

  it("pro-rates the day rate to the band's hours at 26 days, rounding up so it never shows below the law", () => {
    expect(legalMonthly(CITY_RATES, T.cook)).toEqual({ hours: 2.5, month_paise: 642200 }); // ₹6,421.35
    expect(legalMonthly(CITY_RATES, T.maid)).toEqual({ hours: 1.5, month_paise: 349600 }); // ₹3,495.96
    for (const band of CITY_RATES.bands)
      expect(band.low_paise).toBeGreaterThanOrEqual(legalMonthly(CITY_RATES, band.trade)?.month_paise ?? 0);
  });

  it("asks a per-visit trade per visit, and its band is a visit's, never a month's", () => {
    expect(prompt(atRate("electrician", MYSURU)).lines).toEqual([{ key: "iv.ask.rate_visit" }]);
    expect(rateHint(MYSURU, T.electrician)[0]).toMatchObject({
      key: "iv.band_visit",
      prices: { low: 30000, high: 60000 },
    });
    expect(
      rateHint(CITY_RATES, T.electrician, {
        ...LEGAL_MINIMUM,
        trades: { electrician: { day_paise: 80000, hours: 2 } },
      }),
    ).toEqual([{ key: "iv.band_none", names: { trade: ["trade.electrician"] } }]);
  });

  it("names a city without a catalog name as the card writes it, and shows no other state's minimum", () => {
    expect(rateHint(MYSURU, T.cook)).toEqual([
      {
        key: "iv.band_month",
        names: { trade: ["trade.cook"] },
        params: { city: "Mysuru" },
        prices: { low: 600000, high: 900000 },
      },
    ]);
  });

  it("drops the seed note once a union signs the card, and keeps it for any banded trade of a seed card", () => {
    expect(rateNote(MYSURU, [T.cook])).toEqual([]);
    expect(rateNote(CITY_RATES, [T.electrician])).toEqual([]);
    expect(rateNote(CITY_RATES, [T.electrician, T.maid])).toEqual([{ key: "iv.band_seed" }]);
  });

  it("reads in every language with the city and trade in its script", () => {
    const params = { trade: t("hi", "trade.cook"), city: t("hi", "city.bengaluru"), low: "₹7,000", high: "₹12,000" };
    expect(t("hi", "iv.band_month", params)).toBe("बेंगलुरु में कुक: आम तौर पर महीने का ₹7,000–₹12,000।");
    expect(t("en", "iv.band_seed")).toBe("Researched from public sources, not yet checked by a union.");
    expect(t("kn", "iv.band_none", { trade: t("kn", "trade.electrician") })).toContain("ಎಲೆಕ್ಟ್ರಿಷಿಯನ್");
  });
});
