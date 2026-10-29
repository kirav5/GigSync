import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCOPE,
  ESTIMATE_MAX_PAISE,
  Estimate,
  EstimateRequest,
  EstimateResponse,
  hoursBand,
  isEstimate,
  mealsBucket,
  peopleBand,
  QuestionKey,
  QuoteExtraction,
  roomsBucket,
  SharedPrice,
  Trade,
} from "../src/index.js";

const painter = { city: "bengaluru", trade: "painter", scope: { rooms: "bhk2", labour_only: "yes" } };

const estimate = {
  low_paise: 1400000,
  typical_paise: 1800000,
  high_paise: 2200000,
  unit: "job",
  basis: { sources: [], gigsync_jobs: 0, floored: false },
  as_of: "2026-10-29T10:00:00.000Z",
};

describe("estimate requests", () => {
  it("take a city, a trade and that trade's scope buckets", () => {
    expect(EstimateRequest.safeParse(painter).success).toBe(true);
    expect(EstimateRequest.safeParse({ ...painter, scope: { labour_only: "no" } }).success).toBe(true);
    const cook = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
    expect(EstimateRequest.safeParse(cook).success).toBe(true);
  });

  it("refuse another trade's scope, an unknown city and free text", () => {
    expect(EstimateRequest.safeParse({ ...painter, trade: "cook" }).success).toBe(false);
    expect(EstimateRequest.safeParse({ ...painter, city: "mumbai" }).success).toBe(false);
    expect(EstimateRequest.safeParse({ ...painter, scope: { rooms: "bhk2" } }).success).toBe(false);
    const electrician = { city: "bengaluru", trade: "electrician", scope: { problem: "the fan in my bedroom" } };
    expect(EstimateRequest.safeParse(electrician).success).toBe(false);
  });

  it("drop any detail that is not a bucket, so a household's words cannot ride along", () => {
    const parsed = EstimateRequest.parse({ ...painter, scope: { ...painter.scope, need: "walls are peeling" } });
    expect(parsed.scope).toEqual(painter.scope);
  });

  it("have a default scope for every trade that parses as a request", () => {
    for (const trade of Trade.options) {
      expect(EstimateRequest.safeParse({ city: "bengaluru", trade, scope: DEFAULT_SCOPE[trade] }).success).toBe(true);
    }
  });
});

describe("scope buckets", () => {
  it("coarsen counts into bands", () => {
    expect([0, 1, 2, 3, 4, 7].map(roomsBucket)).toEqual(["bhk1", "bhk1", "bhk2", "bhk3", "bhk4_plus", "bhk4_plus"]);
    expect([1, 2, 3, 4, 5, 9].map(peopleBand)).toEqual(["1_2", "1_2", "3_4", "3_4", "5_plus", "5_plus"]);
    expect([4, 6, 7, 9, 10, 12].map(hoursBand)).toEqual([
      "up_to_6",
      "up_to_6",
      "7_to_9",
      "7_to_9",
      "10_plus",
      "10_plus",
    ]);
    expect([0, 1, 2, 3, 5].map(mealsBucket)).toEqual(["1", "1", "2", "3", "3"]);
  });

  it("the new detail keys are standard question keys", () => {
    for (const key of ["labour_only", "frequency", "hours"]) expect(QuestionKey.safeParse(key).success).toBe(true);
  });
});

describe("estimates", () => {
  it("are ordered low ≤ typical ≤ high and may exceed the UPI cap up to their own ceiling", () => {
    expect(Estimate.safeParse(estimate).success).toBe(true);
    expect(Estimate.safeParse({ ...estimate, low_paise: 1900000 }).success).toBe(false);
    expect(Estimate.safeParse({ ...estimate, high_paise: ESTIMATE_MAX_PAISE }).success).toBe(true);
    expect(Estimate.safeParse({ ...estimate, high_paise: ESTIMATE_MAX_PAISE + 1 }).success).toBe(false);
  });

  it("a response is an estimate or a reason there is none", () => {
    const none = EstimateResponse.parse({ none: "too_few_quotes" });
    expect(isEstimate(none)).toBe(false);
    expect(isEstimate(EstimateResponse.parse(estimate))).toBe(true);
    expect(EstimateResponse.safeParse({ none: "because" }).success).toBe(false);
  });
});

describe("shared prices", () => {
  const shared = { ...painter, area_key: "indiranagar", price_paise: 1500000, month: "2026-10" };

  it("carry the job's buckets, an area slug, a price and a month, and nothing else", () => {
    const parsed = SharedPrice.parse({ ...shared, user: "usr_01HZY3", phone: "+919800000000" });
    expect(parsed).toEqual(shared);
  });

  it("refuse an exact date, an address-like area and a per-square-foot painting price", () => {
    expect(SharedPrice.safeParse({ ...shared, month: "2026-10-29" }).success).toBe(false);
    expect(SharedPrice.safeParse({ ...shared, area_key: "12 MG Road" }).success).toBe(false);
    expect(SharedPrice.safeParse({ ...shared, scope: { labour_only: "yes" } }).success).toBe(false);
  });
});

describe("quote extraction", () => {
  it("is loose about lengths so the checks, not the parser, drop a bad quote", () => {
    const quote = {
      url: "https://example.in/painting-cost",
      sentence: "A 2BHK repaint costs ₹14,000.",
      amount_rupees: 14000,
      unit: "job",
      covers: { rooms: 2, materials_included: false },
      site: "example.in",
    };
    expect(QuoteExtraction.safeParse({ quotes: [quote] }).success).toBe(true);
    expect(QuoteExtraction.safeParse({ quotes: [{ ...quote, unit: "fortnight" }] }).success).toBe(false);
  });
});
