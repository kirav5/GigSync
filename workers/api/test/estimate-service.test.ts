import { env } from "cloudflare:test";
import { type Estimate, type EstimateRequest, type EstimateResponse, isEstimate } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { withDirectory } from "../src/db/client.js";
import { ESTIMATE_TTL_MS, K_MIN, LOCK_TTL_MS } from "../src/estimates/constants.js";
import { serveEstimate } from "../src/estimates/service.js";
import type { QuoteSource } from "../src/estimates/source.js";
import { quoteSourceFor } from "../src/estimates/source.js";
import { COOK, FakeSource, MAID, quotesAt } from "./estimate-fakes.js";
import { sql } from "./sql.js";

const NOW = new Date("2026-10-29T10:00:00Z");
const SITES = ["a.example", "b.example"];
const later = (ms: number) => new Date(NOW.getTime() + ms);

function serve(source: QuoteSource | undefined, req: EstimateRequest, now = NOW): Promise<EstimateResponse> {
  return withDirectory(env.DIRECTORY.connectionString, undefined, (db) => serveEstimate({ db, source }, req, now));
}

const cooks = () => new FakeSource(() => quotesAt([9000, 10000, 11000, 12000, 14000], SITES));

beforeEach(async () => {
  await sql("DELETE FROM estimate_cache");
  await sql("DELETE FROM shared_prices");
});

describe("estimate cache", () => {
  it("reads the web on a miss, stores the reading, and serves it from the cache after", async () => {
    const source = cooks();
    const first = (await serve(source, COOK)) as Estimate;
    expect(first).toMatchObject({
      low_paise: 1_000_000,
      typical_paise: 1_100_000,
      high_paise: 1_200_000,
      unit: "month",
    });
    expect(first.as_of).toBe(NOW.toISOString());
    expect(first.basis.sources).toHaveLength(5);
    const [row] = await sql<{ quote_count: number; computing_since: Date | null }>(
      "SELECT quote_count, computing_since FROM estimate_cache WHERE trade = 'cook'",
    );
    expect(row).toEqual({ quote_count: 5, computing_since: null });

    expect(await serve(source, COOK, later(ESTIMATE_TTL_MS - 1))).toEqual(first);
    expect(source.calls).toBe(1);
  });

  it("never caches a source that is not cached (the local fixture), and reads it every time", async () => {
    const source = new FakeSource(() => quotesAt([9000, 10000, 11000, 12000, 14000], SITES), false);
    expect(isEstimate(await serve(source, COOK))).toBe(true);
    expect(isEstimate(await serve(source, COOK))).toBe(true);
    expect(source.calls).toBe(2);
    expect(await sql("SELECT 1 FROM estimate_cache")).toHaveLength(0);
  });

  it("reads again once the reading is older than the TTL", async () => {
    const source = cooks();
    await serve(source, COOK);
    const again = (await serve(source, COOK, later(ESTIMATE_TTL_MS + 1))) as Estimate;
    expect(source.calls).toBe(2);
    expect(again.as_of).toBe(later(ESTIMATE_TTL_MS + 1).toISOString());
  });

  it("serves the old reading, with its date, while a new one fails", async () => {
    await serve(cooks(), COOK);
    const failing = new FakeSource(() => {
      throw new Error("upstream down");
    });
    const stale = (await serve(failing, COOK, later(ESTIMATE_TTL_MS + 1))) as Estimate;
    expect(failing.calls).toBe(1);
    expect(stale).toMatchObject({ typical_paise: 1_100_000, as_of: NOW.toISOString() });
  });

  it("keeps one entry per scope bucket", async () => {
    const source = cooks();
    await serve(source, COOK);
    await serve(source, { city: "bengaluru", trade: "cook", scope: { people: "5_plus", meals: "3" } });
    expect(source.calls).toBe(2);
    const rows = await sql<{ bucket: string }>("SELECT bucket FROM estimate_cache ORDER BY bucket");
    expect(rows.map((r) => r.bucket)).toEqual(["meals=2;people=3_4", "meals=3;people=5_plus"]);
  });

  it("caches too few quotes like an estimate, so a thin job is not re-read every time", async () => {
    const source = new FakeSource(() => quotesAt([9000, 10000], SITES));
    expect(await serve(source, COOK)).toEqual({ none: "too_few_quotes" });
    expect(await serve(source, COOK, later(1000))).toEqual({ none: "too_few_quotes" });
    expect(source.calls).toBe(1);
  });
});

describe("one reading at a time", () => {
  it("answers pending to a request that arrives while another reads the web for the same job", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = new FakeSource(async () => {
      await gate;
      return quotesAt([9000, 10000, 11000, 12000, 14000], SITES);
    });
    const first = serve(slow, COOK);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const second = cooks();
    expect(await serve(second, COOK)).toEqual({ none: "pending" });
    expect(second.calls).toBe(0);
    release();
    expect(isEstimate(await first)).toBe(true);
  });

  it("spaces out retries after a failure until the claim goes stale", async () => {
    const failing = new FakeSource(() => {
      throw new Error("upstream down");
    });
    expect(await serve(failing, COOK)).toEqual({ none: "failed" });
    expect(await serve(failing, COOK, later(1000))).toEqual({ none: "pending" });
    expect(failing.calls).toBe(1);
    const source = cooks();
    expect(isEstimate(await serve(source, COOK, later(LOCK_TTL_MS + 1)))).toBe(true);
  });
});

describe("no quote source", () => {
  it("answers unavailable, never throws", async () => {
    expect(await serve(undefined, COOK)).toEqual({ none: "unavailable" });
  });

  it("uses no source without a key, the fixture only locally, and the model when its key is set", () => {
    const base = { ENVIRONMENT: "pilot" } as Parameters<typeof quoteSourceFor>[0];
    expect(quoteSourceFor(base)).toBeUndefined();
    expect(quoteSourceFor({ ...base, ESTIMATE_SOURCE: "fixture" })).toBeUndefined();
    expect(quoteSourceFor({ ...base, ESTIMATE_SOURCE: "fixture", ENVIRONMENT: "local" })?.name).toBe("fixture");
    expect(quoteSourceFor({ ...base, ANTHROPIC_API_KEY: "" })).toBeUndefined();
    expect(quoteSourceFor({ ...base, ANTHROPIC_API_KEY: "not-a-real-key" })?.name).toBe("anthropic");
  });
});

async function share(count: number, price: number, month = "2026-10") {
  const values = Array.from(
    { length: count },
    () => `('bengaluru', 'cook', 'meals=2;people=3_4', 'hsr', ${price}, '${month}-01')`,
  );
  await sql(
    `INSERT INTO shared_prices (city, trade, bucket, area_key, price_paise, month) VALUES ${values.join(", ")}`,
  );
}

describe("shared prices", () => {
  it("are unused below K_MIN and blended from K_MIN, weighted by count", async () => {
    await share(K_MIN - 1, 2_000_000);
    const below = (await serve(cooks(), COOK)) as Estimate;
    expect(below).toMatchObject({ typical_paise: 1_100_000, basis: { gigsync_jobs: 0 } });
    await share(1, 2_000_000);
    const blended = (await serve(cooks(), COOK)) as Estimate;
    // (5 × ₹11,000 + 10 × ₹20,000) / 15 = ₹17,000
    expect(blended).toMatchObject({ typical_paise: 1_700_000, basis: { gigsync_jobs: K_MIN } });
  });

  it("stand alone from K_MIN when the web has too few quotes", async () => {
    await share(K_MIN, 1_500_000);
    const e = await serve(new FakeSource(() => quotesAt([9000], SITES)), COOK);
    expect(e).toMatchObject({ typical_paise: 1_500_000, basis: { sources: [], gigsync_jobs: K_MIN } });
  });

  it("count only from the last twelve months", async () => {
    await share(K_MIN, 2_000_000, "2025-10");
    expect(await serve(undefined, COOK)).toEqual({ none: "unavailable" });
  });
});

describe("the legal floor", () => {
  it("raises any figure below the statutory minimum and says so", async () => {
    const maids = new FakeSource(() => quotesAt([2500, 3000, 3500, 4500, 5500], SITES, "month", { rooms: 2 }));
    const e = (await serve(maids, MAID)) as Estimate;
    expect(e).toMatchObject({ low_paise: 350_000, typical_paise: 350_000, high_paise: 450_000 });
    expect(e.basis).toMatchObject({ legal_minimum_paise: 350_000, floored: true });
  });
});
