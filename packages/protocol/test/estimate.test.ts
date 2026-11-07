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
  roomsBucket,
  Trade,
} from "../src/index.js";

const painter = { city: "bengaluru", trade: "painter", scope: { rooms: "bhk2", labour_only: "yes" } };

const estimate = {
  low_paise: 1400000,
  typical_paise: 1800000,
  high_paise: 2200000,
  unit: "job",
  basis: { kind: "rate_card", gigsync_jobs: 0, floored: false },
  as_of: "2026-10-29T10:00:00.000Z",
};

describe("estimate requests", () => {
  it("take a city, a trade and that trade's scope buckets", () => {
    expect(EstimateRequest.safeParse(painter).success).toBe(true);
    expect(EstimateRequest.safeParse({ ...painter, scope: { labour_only: "no" } }).success).toBe(true);
    const cook = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
    expect(EstimateRequest.safeParse(cook).success).toBe(true);
  });

  it("refuse another trade's scope, a malformed city and free text", () => {
    expect(EstimateRequest.safeParse({ ...painter, trade: "cook" }).success).toBe(false);
    // Any well-formed city key is taken (ADR 0061): a city GigSync does not serve gets no estimate, not a refusal.
    expect(EstimateRequest.safeParse({ ...painter, city: "Mumbai City" }).success).toBe(false);
    expect(EstimateRequest.safeParse({ ...painter, city: "kanpur" }).success).toBe(true);
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
    const none = EstimateResponse.parse({ none: "unavailable" });
    expect(isEstimate(none)).toBe(false);
    expect(isEstimate(EstimateResponse.parse(estimate))).toBe(true);
    expect(EstimateResponse.safeParse({ none: "because" }).success).toBe(false);
    expect(EstimateResponse.safeParse({ none: "too_few_quotes" }).success).toBe(false);
  });
});

describe("market areas and bases (ADR 0039)", () => {
  it("a request may name a pilot area by its slug, never an address", () => {
    expect(EstimateRequest.parse({ ...painter, area: "hsr-layout" }).area).toBe("hsr-layout");
    expect(EstimateRequest.safeParse({ ...painter, area: "12 MG Road" }).success).toBe(false);
  });

  it("a basis says whether the range is GigSync's, with its jobs and area, or the rate card's", () => {
    const gigsync = {
      ...estimate,
      basis: { kind: "gigsync", sources: [], gigsync_jobs: 34, area: "jayanagar", floored: false },
    };
    expect(Estimate.parse(gigsync).basis).toMatchObject({ kind: "gigsync", gigsync_jobs: 34, area: "jayanagar" });
    expect(Estimate.safeParse({ ...gigsync, basis: { ...gigsync.basis, kind: "shared" } }).success).toBe(false);
  });

  it("no range rests on web quotes or a model: those kinds, and a basis with no kind, are refused", () => {
    for (const kind of ["web", "model", undefined]) {
      expect(Estimate.safeParse({ ...estimate, basis: { ...estimate.basis, kind } }).success).toBe(false);
    }
  });

  it("the source list an older phone requires is always empty", () => {
    const listed = { ...estimate, basis: { ...estimate.basis, sources: [] } };
    expect(Estimate.parse(listed).basis.sources).toEqual([]);
    const quoted = { ...estimate, basis: { ...estimate.basis, sources: [{ url: "https://example.in" }] } };
    expect(Estimate.safeParse(quoted).success).toBe(false);
  });
});
