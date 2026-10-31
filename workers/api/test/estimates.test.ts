import { HttpMethod } from "@gigsync/core";
import { DEFAULT_SCOPE, Estimate, EstimateResponse } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { K_MIN } from "../src/estimates/constants.js";
import { COOK, MAID, PAINTER } from "./estimate-fakes.js";
import { clearMarket, many, seedCookJobs } from "./market-helpers.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { sql } from "./sql.js";

const ESTIMATES = "/estimates";

beforeEach(async () => {
  await sql("DELETE FROM estimate_cache");
  await clearMarket();
});

describe("POST /v1/estimates (fixture quote source)", () => {
  it("answers a painter 2BHK estimate from checked quotes, with their sources", async () => {
    const p = await signIn("+919855500001");
    const res = await call(p, HttpMethod.post, ESTIMATES, PAINTER);
    expect(res.status).toBe(200);
    const e = Estimate.parse(await res.json());
    expect(e).toMatchObject({ low_paise: 1_400_000, typical_paise: 1_600_000, high_paise: 1_800_000, unit: "job" });
    expect(e.basis).toMatchObject({ kind: "web", gigsync_jobs: 0, floored: false });
    expect(e.basis.legal_minimum_paise).toBeUndefined();
    expect(e.basis.sources).toHaveLength(5);
    expect(new Set(e.basis.sources.map((s) => s.site))).toEqual(
      new Set(["homepaint.example", "paintpros.example", "urbanfix.example"]),
    );
    expect(e.basis.sources.map((s) => s.sentence).join(" ")).not.toContain("₹15,000 on average");
  });

  it("answers cook and maid estimates, the maid's raised to the legal floor", async () => {
    const p = await signIn("+919855500002");
    const cook = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, COOK)).json());
    expect(cook).toMatchObject({
      low_paise: 1_000_000,
      typical_paise: 1_100_000,
      high_paise: 1_200_000,
      unit: "month",
    });
    expect(cook.basis).toMatchObject({ legal_minimum_paise: 643_000, floored: false });
    const maid = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, MAID)).json());
    expect(maid).toMatchObject({ low_paise: 350_000, typical_paise: 350_000, high_paise: 450_000 });
    expect(maid.basis).toMatchObject({ legal_minimum_paise: 350_000, floored: true });
  });

  it("answers no estimate, not an error, for a job the sources say too little about", async () => {
    const p = await signIn("+919855500003");
    const driver = { city: "bengaluru", trade: "driver", scope: DEFAULT_SCOPE.driver };
    const res = await call(p, HttpMethod.post, ESTIMATES, driver);
    expect(res.status).toBe(200);
    expect(EstimateResponse.parse(await res.json())).toEqual({ none: "too_few_quotes" });
    const threeBhk = { ...PAINTER, scope: { rooms: "bhk3", labour_only: "yes" } };
    expect(await (await call(p, HttpMethod.post, ESTIMATES, threeBhk)).json()).toEqual({ none: "too_few_quotes" });
  });

  it("refuses bad input: another trade's scope, free text, an unknown city, no body", async () => {
    const p = await signIn("+919855500004");
    for (const body of [
      { ...PAINTER, trade: "cook" },
      { city: "bengaluru", trade: "electrician", scope: { problem: "my fan sparks" } },
      { ...COOK, city: "mumbai" },
      "not json",
    ]) {
      const res = await call(p, HttpMethod.post, ESTIMATES, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad request" });
    }
  });

  it("needs a session", async () => {
    expect((await call(undefined, HttpMethod.post, ESTIMATES, PAINTER)).status).toBe(401);
  });
});

describe("market prices through the route (ADR 0039 §1)", () => {
  it("answers from K_MIN jobs agreed on GigSync in the request's area, before any web quote", async () => {
    const p = await signIn("+919855500021");
    await seedCookJobs(many(K_MIN, 1_250_000, { area: "jayanagar" }), new Date());
    const e = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, { ...COOK, area: "jayanagar" })).json());
    expect(e).toMatchObject({ typical_paise: 1_250_000, basis: { kind: "gigsync", gigsync_jobs: K_MIN } });
    expect(e.basis.area).toBe("jayanagar");
  });

  it("refuses an area that is not a slug", async () => {
    const p = await signIn("+919855500022");
    expect((await call(p, HttpMethod.post, ESTIMATES, { ...COOK, area: "4th Block" })).status).toBe(400);
  });
});

describe("shared prices are gone (ADR 0039 §1)", () => {
  it("POST /v1/estimates/prices is no longer a route", async () => {
    const p = await signIn("+919855500023");
    const shared = { ...COOK, area_key: "jayanagar", price_paise: 1_500_000, month: "2026-10" };
    expect((await call(p, HttpMethod.post, "/estimates/prices", shared)).status).toBe(404);
  });
});
