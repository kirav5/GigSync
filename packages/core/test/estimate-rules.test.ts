import { City, type Estimate, Lang, type RateBand, RateUnit, Role, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ApiClient,
  estimateBand,
  estimateRequest,
  FAR_ABOVE_SHARE,
  FAR_BELOW_SHARE,
  legalFloor,
  OfferNote,
  offerNote,
  perJob,
  ReasonKind,
  reasonText,
  SCOPE_KEYS,
  suggestForHousehold,
  suggestForWorker,
  suggestFromEstimate,
} from "../src/index.js";
import { COOK_MONTH, PAINT_2BHK, PAINT_SQFT } from "./estimate-fixtures.js";
import { BENGALURU_RATES } from "./phones.js";

const T = Trade.enum;
const city = City.enum.bengaluru;
const painting = (estimate: Estimate = PAINT_2BHK) => ({ estimate, trade: T.painter, city });

describe("suggestions from an estimate, never mandates", () => {
  it("the worker opens at the typical figure and is offered the low one as the least they take", () => {
    expect(suggestForWorker(painting())).toEqual({ opening_paise: 1_600_000, limit_paise: 1_400_000 });
    expect(suggestFromEstimate(painting(), Role.enum.provider)).toEqual(suggestForWorker(painting()));
  });

  it("rounds up to the next ₹10 in the worker's favour", () => {
    const odd = { ...PAINT_2BHK, low_paise: 1_400_001, typical_paise: 1_600_001 };
    expect(suggestForWorker(painting(odd))).toEqual({ opening_paise: 1_601_000, limit_paise: 1_401_000 });
  });

  it("the household is offered the typical figure as its budget", () => {
    expect(suggestForHousehold(painting())).toEqual({ budget_paise: 1_600_000 });
    expect(suggestFromEstimate(painting(), Role.enum.requester)).toEqual({ budget_paise: 1_600_000 });
  });

  it("never suggests below the legal minimum the server floored at", () => {
    const low = { ...COOK_MONTH, low_paise: 500_000, typical_paise: 600_000 };
    const job = { estimate: low, trade: T.cook, city };
    expect(legalFloor(job)).toBe(643_000);
    expect(suggestForWorker(job)).toEqual({ opening_paise: 643_000, limit_paise: 643_000 });
    expect(suggestForHousehold(job)).toEqual({ budget_paise: 643_000 });
  });

  it("applies the state's monthly minimum for a monthly trade even when the server sent none", () => {
    const unfloored = { ...COOK_MONTH, low_paise: 300_000, typical_paise: 400_000, basis: { ...COOK_MONTH.basis } };
    delete unfloored.basis.legal_minimum_paise;
    const job = { estimate: unfloored, trade: T.cook, city };
    // ₹790.32 × 2.5 h × 26 days / 8 h = ₹6,421.35, rounded up to ₹6,430.
    expect(legalFloor(job)).toBe(643_000);
    expect(suggestForWorker(job).limit_paise).toBe(643_000);
    // Not for a per-job estimate: the law names a monthly wage.
    expect(legalFloor({ estimate: { ...unfloored, unit: RateUnit.enum.job }, trade: T.cook, city })).toBe(0);
  });
});

describe("a job's details as an estimate request", () => {
  it("buckets a painter's rooms from any count and keeps who buys the paint", () => {
    expect(estimateRequest(city, T.painter, { rooms: "2BHK", labour_only: "no" })).toEqual({
      city,
      trade: T.painter,
      scope: { rooms: "bhk2", labour_only: "no" },
      // The details travel as drivers too, so the estimate knows them (ADR 0041 §3).
      drivers: { rooms: 2, paint_by: "worker" },
    });
    expect(estimateRequest(city, T.painter, { rooms: "५ कमरे" })?.scope).toEqual({
      rooms: "bhk4_plus",
      labour_only: "yes",
    });
  });

  it("prices painting per square foot when only the area is known, the default 2BHK when nothing is", () => {
    expect(estimateRequest(city, T.painter, { area_sqft: "900 sq ft" })?.scope).toEqual({ labour_only: "yes" });
    expect(estimateRequest(city, T.painter)?.scope).toEqual({ rooms: "bhk2", labour_only: "yes" });
  });

  it("buckets a cook's people and meals, a driver's hours and a maid's visits", () => {
    expect(estimateRequest(city, T.cook, { people: "5", meals: "3 meals" })?.scope).toEqual({
      people: "5_plus",
      meals: "3",
    });
    expect(estimateRequest(city, T.driver, { hours: "10" })?.scope).toEqual({ hours: "10_plus" });
    expect(estimateRequest(city, T.maid, { rooms: "3", frequency: "weekly" })?.scope).toEqual({
      rooms: "bhk3",
      frequency: "weekly",
    });
  });

  it("never sends the household's words: a problem described in free text is 'other'", () => {
    expect(estimateRequest(city, T.electrician, { problem: "fan making noise since Monday" })?.scope).toEqual({
      problem: "other",
    });
    expect(estimateRequest(city, T.plumber, { problem: "leak" })?.scope).toEqual({ problem: "leak" });
  });

  it("multiplies a per-square-foot estimate by the job's area, and gives none without one", () => {
    const whole = perJob(PAINT_SQFT, { area_sqft: "1000" });
    expect(whole).toMatchObject({ unit: RateUnit.enum.job, low_paise: 1_200_000, high_paise: 1_800_000 });
    expect(perJob(PAINT_SQFT, {})).toBeUndefined();
    expect(perJob(PAINT_2BHK, {})).toBe(PAINT_2BHK);
  });
});

describe("the note on an offer far outside the estimate", () => {
  it("tells a worker when an offer is below 80% of the low figure, and only then", () => {
    const edge = PAINT_2BHK.low_paise * FAR_BELOW_SHARE;
    expect(offerNote(PAINT_2BHK, Role.enum.provider, edge - 1000)).toBe(OfferNote.below);
    expect(offerNote(PAINT_2BHK, Role.enum.provider, edge)).toBeUndefined();
    expect(offerNote(PAINT_2BHK, Role.enum.provider, 5_000_000)).toBeUndefined();
  });

  it("tells a household when an offer is above 120% of the high figure, and only then", () => {
    const edge = PAINT_2BHK.high_paise * FAR_ABOVE_SHARE;
    expect(offerNote(PAINT_2BHK, Role.enum.requester, edge + 1000)).toBe(OfferNote.above);
    expect(offerNote(PAINT_2BHK, Role.enum.requester, edge)).toBeUndefined();
    expect(offerNote(PAINT_2BHK, Role.enum.requester, 100)).toBeUndefined();
  });
});

describe("an estimate as the agent's band", () => {
  it("replaces the city band and drops only the scope rules the estimate already priced", () => {
    const cityBand = BENGALURU_RATES.bands[0] as RateBand;
    const band = estimateBand(COOK_MONTH, T.cook, cityBand);
    expect(band).toMatchObject({ low_paise: 1_000_000, high_paise: 1_200_000 });
    expect(band.scope.map((r) => r.key)).toEqual(["pets"]);
    expect(SCOPE_KEYS[T.cook]).toContain("people");
    // Without a city band, only the rule the agreed terms add: coats past two (ADR 0033 §3).
    expect(estimateBand(PAINT_2BHK, T.painter).scope.map((r) => r.key)).toEqual(["coats"]);
  });

  it("says the going rate for a band that does not rest on GigSync's jobs", () => {
    const reason = { kind: ReasonKind.band, low_paise: 1_400_000, high_paise: 1_800_000 } as const;
    expect(reasonText(Lang.enum.en, reason)).toContain("going rate");
  });
});

describe("the API client's estimate calls", () => {
  const client = (body: unknown, status = 200, seen: string[] = []) =>
    new ApiClient("https://api.test", async (url, init) => {
      seen.push(`${init?.method} ${url} ${init?.body}`);
      return new Response(status === 204 ? null : JSON.stringify(body), { status });
    });

  it("parses an estimate and a 'no estimate' answer", async () => {
    expect(await client(PAINT_2BHK).estimate({ city, trade: T.cook, scope: { people: "3_4", meals: "2" } })).toEqual(
      PAINT_2BHK,
    );
    expect(
      await client({ none: "unavailable" }).estimate({ city, trade: T.driver, scope: { hours: "7_to_9" } }),
    ).toEqual({ none: "unavailable" });
    await expect(
      client({ low_paise: "lots" }).estimate({ city, trade: T.driver, scope: { hours: "7_to_9" } }),
    ).rejects.toThrow();
  });
});
