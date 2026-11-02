import { type Lang, RateCard, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  hear,
  type InterviewState,
  LEGAL_MINIMUM,
  legalMonthly,
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
/** A maid or driver says which work they take first (ADR 0046): monthly, as every card before arrangements. */
const ARRANGED = new Set(["maid", "driver"]);
const atRate = (trade: string, rates?: RateCard) =>
  run(start(config("en", rates)), [trade, ...(ARRANGED.has(trade) ? ["monthly"] : []), "Koramangala"]);
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
  it("shows a cook the band, the legal minimum and the seed note under the rate, and only the minimum under the least", () => {
    const rate = atRate("cook");
    expect(prompt(rate).lines).toEqual([
      { key: "iv.ask.rate_month" },
      {
        key: "iv.band_month",
        names: { trade: ["trade.cook"], city: ["city.bengaluru"] },
        prices: { low: 700000, high: 1200000 },
      },
      { key: "iv.legal_min", names: { trade: ["trade.cook"] }, params: { hours: 2.5 }, prices: { min: 642200 } },
      { key: "iv.band_seed" },
    ]);
    const min = hear(rate, "9000");
    expect(min.slot).toBe(Slot.min);
    expect(prompt(min).secret).toBe(true);
    // Heard a moment ago under the rate question, so the range is not read out again.
    expect(prompt(min).lines.map((l) => l.key)).toEqual(["iv.got_rate", "iv.ask.min", "iv.legal_min"]);
  });

  it("is public, so it is read aloud; the worker's typed lowest is not, nor is it on any hint", () => {
    const min = hear(atRate("maid"), "5000");
    const hint = prompt(min).lines.slice(2);
    expect(hint.every((l) => !l.silent)).toBe(true);
    expect(JSON.stringify(hint)).not.toContain("500000");
    expect(hear(min, "4000").notes).toEqual([{ key: "iv.got_min", prices: { price: 400000 }, silent: true }]);
  });

  it("pro-rates the day rate to the band's hours at 26 days, rounding up so it never shows below the law", () => {
    expect(legalMonthly(CITY_RATES, T.cook)).toEqual({ hours: 2.5, month_paise: 642200 }); // ₹6,421.35
    expect(legalMonthly(CITY_RATES, T.maid)).toEqual({ hours: 1.5, month_paise: 349600 }); // ₹3,495.96
    for (const band of CITY_RATES.bands)
      expect(band.low_paise).toBeGreaterThanOrEqual(legalMonthly(CITY_RATES, band.trade)?.month_paise ?? 0);
  });

  it("says there is no usual range for a trade without a band, with no minimum and no seed note", () => {
    expect(prompt(atRate("electrician")).lines).toEqual([
      { key: "iv.ask.rate_visit" },
      { key: "iv.band_none", names: { trade: ["trade.electrician"] } },
    ]);
  });

  it("asks a per-visit trade per visit, and its band is a visit's, never a month's", () => {
    const lines = prompt(atRate("electrician", MYSURU)).lines;
    expect(lines.map((l) => l.key)).toEqual(["iv.ask.rate_visit", "iv.band_visit"]);
    expect(lines[1]).toMatchObject({ prices: { low: 30000, high: 60000 } });
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
