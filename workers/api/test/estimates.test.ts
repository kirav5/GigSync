import { HttpMethod } from "@gigsync/core";
import { DEFAULT_SCOPE, driversFromScope, Estimate, type EstimateRequest } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { K_MIN } from "../src/estimates/constants.js";
import { clearMarket, many, seedCookJobs } from "./market-helpers.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

const ESTIMATES = "/estimates";
const COOK: EstimateRequest = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
const MAID: EstimateRequest = { city: "bengaluru", trade: "maid", scope: { rooms: "bhk2", frequency: "daily" } };
const PAINTER: EstimateRequest = { city: "bengaluru", trade: "painter", scope: { rooms: "bhk2", labour_only: "yes" } };

beforeEach(clearMarket);

describe("POST /v1/estimates from a phone that sends scope buckets only", () => {
  it("answers a painter 2BHK from the city's rate card, as if its buckets were drivers", async () => {
    const p = await signIn("+919855500001");
    const res = await call(p, HttpMethod.post, ESTIMATES, PAINTER);
    expect(res.status).toBe(200);
    const e = Estimate.parse(await res.json());
    expect(e).toMatchObject({ unit: "job", basis: { kind: "rate_card", gigsync_jobs: 0, floored: false } });
    expect(e.basis.legal_minimum_paise).toBeUndefined();
    const asDrivers = { ...PAINTER, drivers: driversFromScope(PAINTER.trade, PAINTER.scope) };
    const same = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, asDrivers)).json());
    expect({ ...same, as_of: e.as_of }).toEqual(e);
  });

  it("answers cook, maid and driver estimates, the household work with its legal floor", async () => {
    const p = await signIn("+919855500002");
    const cook = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, COOK)).json());
    expect(cook).toMatchObject({ unit: "month", basis: { kind: "rate_card", legal_minimum_paise: 643_000 } });
    const maid = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, MAID)).json());
    expect(maid.basis.legal_minimum_paise).toBe(350_000);
    expect(maid.low_paise).toBeGreaterThanOrEqual(350_000);
    const driver = { city: "bengaluru", trade: "driver", scope: DEFAULT_SCOPE.driver };
    const res = await call(p, HttpMethod.post, ESTIMATES, driver);
    expect(res.status).toBe(200);
    expect(Estimate.parse(await res.json()).unit).toBe("month");
  });

  it("refuses bad input: another trade's scope, free text, an unknown city, no body", async () => {
    const p = await signIn("+919855500004");
    for (const body of [
      { ...PAINTER, trade: "cook" },
      { city: "bengaluru", trade: "electrician", scope: { problem: "my fan sparks" } },
      { ...COOK, city: "mumbai" },
      { city: "bengaluru", job_type: "wedding photographer" },
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
  it("answers from K_MIN jobs agreed on GigSync in the request's area, ahead of the rate card", async () => {
    const p = await signIn("+919855500021");
    await seedCookJobs(many(K_MIN, 1_250_000, { area: "jayanagar" }), new Date());
    const e = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, { ...COOK, area: "jayanagar" })).json());
    expect(e.basis).toMatchObject({ kind: "gigsync", blend: ["gigsync", "rate_card"], gigsync_jobs: K_MIN });
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
