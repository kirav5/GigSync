import { HttpMethod } from "@gigsync/core";
import { DEFAULT_SCOPE, Estimate, EstimateResponse } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_SHARES_PER_DAY } from "../src/estimates/constants.js";
import { COOK, MAID, PAINTER } from "./estimate-fakes.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { sql } from "./sql.js";

const ESTIMATES = "/estimates";
const PRICES = "/estimates/prices";

beforeEach(async () => {
  await sql("DELETE FROM estimate_cache");
  await sql("DELETE FROM shared_prices");
});

describe("POST /v1/estimates (fixture quote source)", () => {
  it("answers a painter 2BHK estimate from checked quotes, with their sources", async () => {
    const p = await signIn("+919855500001");
    const res = await call(p, HttpMethod.post, ESTIMATES, PAINTER);
    expect(res.status).toBe(200);
    const e = Estimate.parse(await res.json());
    expect(e).toMatchObject({ low_paise: 1_400_000, typical_paise: 1_600_000, high_paise: 1_800_000, unit: "job" });
    expect(e.basis).toMatchObject({ gigsync_jobs: 0, floored: false });
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

const price = (more: Record<string, unknown> = {}) => ({
  ...COOK,
  scope: { people: "5_plus", meals: "3" },
  area_key: "hsr-layout",
  price_paise: 1_500_000,
  month: new Date().toISOString().slice(0, 7),
  ...more,
});

describe("POST /v1/estimates/prices", () => {
  it("stores a shared price with no user id, no exact date and no extra fields", async () => {
    const p = await signIn("+919855500011");
    const res = await call(p, HttpMethod.post, PRICES, { ...price(), user: p.session.user, name: "Asha" });
    expect(res.status).toBe(204);
    const rows = await sql<Record<string, unknown>>("SELECT * FROM shared_prices");
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
      ["area_key", "bucket", "city", "month", "price_id", "price_paise", "trade"].sort(),
    );
    expect(JSON.stringify(rows)).not.toContain(p.session.user);
    expect(rows[0]).toMatchObject({ bucket: "meals=3;people=5_plus", price_paise: 1_500_000 });
  });

  it("refuses a bad body, a future or old month, and a per-sq-ft painting price", async () => {
    const p = await signIn("+919855500012");
    for (const body of [
      price({ month: "2099-01" }),
      price({ month: "2020-01" }),
      price({ price_paise: 0 }),
      price({ area_key: "12, MG Road" }),
      { ...PAINTER, scope: { labour_only: "yes" }, area_key: "hsr", price_paise: 100_000, month: "2026-10" },
    ]) {
      expect((await call(p, HttpMethod.post, PRICES, body)).status).toBe(400);
    }
    expect(await sql("SELECT 1 FROM shared_prices")).toHaveLength(0);
  });

  it("allows a user a few shares a day, then 429", async () => {
    const p = await signIn("+919855500013");
    for (let i = 0; i < MAX_SHARES_PER_DAY; i++) {
      expect((await call(p, HttpMethod.post, PRICES, price())).status).toBe(204);
    }
    const res = await call(p, HttpMethod.post, PRICES, price());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too many attempts" });
    expect((await call(await signIn("+919855500014"), HttpMethod.post, PRICES, price())).status).toBe(204);
    expect(await sql("SELECT 1 FROM shared_prices")).toHaveLength(MAX_SHARES_PER_DAY + 1);
  });

  it("needs a session", async () => {
    expect((await call(undefined, HttpMethod.post, PRICES, price())).status).toBe(401);
  });
});
