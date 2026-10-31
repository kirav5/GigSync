import { env } from "cloudflare:test";
import { City, type Estimate, type EstimateRequest, type EstimateResponse } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { withDirectory } from "../src/db/client.js";
import { K_MIN } from "../src/estimates/constants.js";
import { serveEstimate } from "../src/estimates/service.js";
import type { QuoteSource } from "../src/estimates/source.js";
import { COOK, FakeSource, MAID, PAINTER, quotesAt } from "./estimate-fakes.js";
import { clearMarket, many, seedCookJobs } from "./market-helpers.js";
import { sql } from "./sql.js";

/** Market prices from job records (ADR 0039 §1): GigSync's agreed prices first, the web's quotes as the fallback. */

const NOW = new Date("2026-10-29T10:00:00Z");
const JAYANAGAR = "jayanagar";
const IN_JAYANAGAR: EstimateRequest = { ...COOK, area: JAYANAGAR };
const SITES = ["a.example", "b.example"];
/** The web says ₹10,000–₹12,000 for the default cook bucket. */
const web = () => new FakeSource(() => quotesAt([9000, 10000, 11000, 12000, 14000], SITES));
const WEB_TYPICAL = 1_100_000;

/** With no source given, the web's fake; `NO_SOURCE` for a server with no quote source at all. */
const NO_SOURCE = null;
function serve(req: EstimateRequest, given?: QuoteSource | typeof NO_SOURCE): Promise<EstimateResponse> {
  const source = given === NO_SOURCE ? undefined : (given ?? web());
  return withDirectory(env.DIRECTORY.connectionString, undefined, (db) => serveEstimate({ db, source }, req, NOW));
}

beforeEach(async () => {
  await clearMarket();
  await sql("DELETE FROM estimate_cache");
});

describe("a range from GigSync's agreed prices", () => {
  it("is the 25th, 50th and 75th percentile of the area's prices, saying how many jobs and where", async () => {
    // ₹10,000, ₹11,000 … ₹19,000: type-7 percentiles ₹12,250, ₹14,500, ₹16,750, rounded to ₹10.
    await seedCookJobs(
      Array.from({ length: K_MIN }, (_, i) => ({ price: 1_000_000 + i * 100_000, area: JAYANAGAR })),
      NOW,
    );
    const source = web();
    const e = (await serve(IN_JAYANAGAR, source)) as Estimate;
    expect(e).toMatchObject({ low_paise: 1_225_000, typical_paise: 1_450_000, high_paise: 1_675_000, unit: "month" });
    expect(e.basis).toMatchObject({ kind: "gigsync", gigsync_jobs: K_MIN, area: JAYANAGAR, sources: [] });
    expect(e.as_of).toBe(NOW.toISOString());
    expect(source.calls).toBe(0);
  });

  it("counts attested and one-sided jobs alike, and never cancelled or older than twelve months", async () => {
    const year = new Date("2025-10-28T10:00:00Z");
    await seedCookJobs(
      [
        ...many(K_MIN - 2, 1_500_000, { area: JAYANAGAR }),
        { price: 1_500_000, area: JAYANAGAR, attested: false },
        { price: 1_500_000, area: JAYANAGAR, status: "agreed" },
        ...many(5, 9_000_000, { area: JAYANAGAR, status: "cancelled" }),
        ...many(5, 9_000_000, { area: JAYANAGAR, agreedAt: year }),
      ],
      NOW,
    );
    const e = (await serve(IN_JAYANAGAR)) as Estimate;
    expect(e).toMatchObject({ low_paise: 1_500_000, high_paise: 1_500_000, basis: { gigsync_jobs: K_MIN } });
  });

  it("counts only the request's scope bucket", async () => {
    await seedCookJobs(many(K_MIN, 2_500_000, { area: JAYANAGAR, people: "5_plus" }), NOW);
    expect(await serve(IN_JAYANAGAR)).toMatchObject({ typical_paise: WEB_TYPICAL, basis: { kind: "web" } });
  });

  it("widens to the city when the area has fewer than K_MIN, counting jobs with no area too", async () => {
    await seedCookJobs([...many(4, 1_300_000, { area: JAYANAGAR }), ...many(K_MIN - 4, 1_300_000)], NOW);
    const e = (await serve(IN_JAYANAGAR)) as Estimate;
    expect(e).toMatchObject({ typical_paise: 1_300_000, basis: { kind: "gigsync", gigsync_jobs: K_MIN } });
    expect(e.basis.area).toBeUndefined();
  });

  it("is the city's for a request with no area", async () => {
    await seedCookJobs(many(K_MIN, 1_300_000, { area: JAYANAGAR }), NOW);
    expect(await serve(COOK)).toMatchObject({ typical_paise: 1_300_000, basis: { gigsync_jobs: K_MIN } });
  });

  it("floors at the legal minimum, saying so", async () => {
    await seedCookJobs(many(K_MIN, 500_000, { area: JAYANAGAR }), NOW);
    const e = (await serve(IN_JAYANAGAR)) as Estimate;
    expect(e).toMatchObject({ low_paise: 643_000, typical_paise: 643_000, high_paise: 643_000 });
    expect(e.basis).toMatchObject({ kind: "gigsync", legal_minimum_paise: 643_000, floored: true });
  });
});

describe("below K_MIN", () => {
  it("falls back to the web's quotes, and nothing of the jobs shows: no figure, no count", async () => {
    // A price no web quote has, so any trace of it in the answer would be a leak.
    const lone = 1_777_700;
    await seedCookJobs(many(K_MIN - 1, lone, { area: JAYANAGAR }), NOW);
    const e = (await serve(IN_JAYANAGAR)) as Estimate;
    expect(e).toMatchObject({ typical_paise: WEB_TYPICAL, basis: { kind: "web", gigsync_jobs: 0 } });
    expect(e.basis.area).toBeUndefined();
    const text = JSON.stringify(e);
    expect(text).not.toContain(String(lone));
    expect(text).not.toContain("1777");
    expect(text).not.toContain(`"gigsync_jobs":${K_MIN - 1}`);
  });

  it("needs K_MIN different workers and households, not only K_MIN jobs: one pair's jobs show nothing", async () => {
    const theirs = 1_888_800;
    await seedCookJobs(many(K_MIN + 5, theirs, { area: JAYANAGAR }), NOW, true);
    const e = (await serve(IN_JAYANAGAR)) as Estimate;
    expect(e).toMatchObject({ typical_paise: WEB_TYPICAL, basis: { kind: "web", gigsync_jobs: 0 } });
    expect(JSON.stringify(e)).not.toContain(String(theirs));
  });

  it("says no estimate when the web has none either", async () => {
    await seedCookJobs(many(K_MIN - 1, 1_500_000, { area: JAYANAGAR }), NOW);
    expect(await serve(IN_JAYANAGAR, NO_SOURCE)).toEqual({ none: "unavailable" });
  });

  it("the web's range keeps its legal floor", async () => {
    const maids = new FakeSource(() => quotesAt([2500, 3000, 3500, 4500, 5500], SITES, "month", { rooms: 2 }));
    const e = (await serve(MAID, maids)) as Estimate;
    expect(e.basis).toMatchObject({ kind: "web", legal_minimum_paise: 350_000, floored: true });
  });
});

describe("what GigSync's prices never answer", () => {
  it("a per-square-foot painting request: a record's price is for the whole job", async () => {
    const perSqft = { ...PAINTER, scope: { labour_only: "yes" } } as EstimateRequest;
    expect(await serve(perSqft, NO_SOURCE)).toEqual({ none: "unavailable" });
  });

  it("a second city, until job records carry a city (migration 0010)", () => {
    expect(City.options).toEqual(["bengaluru"]);
  });
});
