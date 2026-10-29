import { City, type EngagementId, type EstimateRequest, Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  agentTalk,
  type NewNeed,
  OfferNote,
  ReasonKind,
  SharePrices,
  setSharePrices,
  settle,
  sharePrices,
  TalkKind,
  type WorkerRules,
} from "../src/index.js";
import { COOK_MONTH, estimateOptions, FakeEstimateApi, PAINT_2BHK } from "./estimate-fixtures.js";
import { ASHA, BENGALURU, BENGALURU_RATES, cook, cookNeed, MemoryRelay, phone, RAVI_HOME } from "./phones.js";

const T = Trade.enum;
const byTrade = (request: EstimateRequest) =>
  request.trade === T.painter
    ? PAINT_2BHK
    : request.trade === T.cook
      ? COOK_MONTH
      : { none: "too_few_quotes" as const };

/** Kiran paints in Bengaluru: no city band for painting, his own floor ₹12,000, his usual rate ₹20,000. */
const kiran = (min = 1_200_000): WorkerRules => ({
  trades: [T.painter],
  rate: { opening_paise: 2_000_000, limit_paise: min },
  base: BENGALURU,
  radius_km: 10,
});
const paintNeed = (budget: number): NewNeed => ({
  trade: T.painter,
  need: "Paint my 2BHK",
  when: "next week",
  area: { lat: 12.975, lon: 77.645 },
  details: { rooms: "2", labour_only: "yes" },
  budget: { opening_paise: Math.round(budget * 0.7), limit_paise: budget },
  estimate: PAINT_2BHK,
});

async function pair(rules: WorkerRules, api: FakeEstimateApi) {
  const relay = new MemoryRelay();
  const estimates = estimateOptions(api);
  const worker = await phone(relay, ASHA, { worker: rules, lang: Lang.enum.hi, estimates });
  const household = await phone(relay, RAVI_HOME, { lang: Lang.enum.kn, estimates });
  return { worker, household, talk: () => settle([household.device, worker.device]) };
}

describe("the worker's agent plans from the estimate for the job's scope", () => {
  it("a painter with no city band gets a plan from the estimate, with its sources as the reason", async () => {
    const api = new FakeEstimateApi(byTrade);
    const { worker, household, talk } = await pair(kiran(), api);
    const [job] = await household.device.request(paintNeed(1_700_000), [worker.user]);
    await talk();
    const mine = await worker.device.job(job?.engagement.id as EngagementId);
    expect(api.asked).toContainEqual({
      city: City.enum.bengaluru,
      trade: T.painter,
      scope: { rooms: "bhk2", labour_only: "yes" },
    });
    expect(mine.estimate).toEqual(PAINT_2BHK);
    expect(mine.advice?.reasons[0]).toEqual({
      kind: ReasonKind.band,
      low_paise: 1_400_000,
      high_paise: 1_800_000,
      sources: 5,
    });
    // Limit: his own floor, never raised to the estimate's low (ADR 0030 §5); opening: drawn for this job between the
    // estimate's typical and high figures (ADR 0033).
    expect(mine.mandate?.limit_paise).toBe(1_200_000);
    const at = mine.strategy?.opening ?? 1;
    const typical = PAINT_2BHK.typical_paise;
    const opening = Math.ceil(Math.round(typical + (1_800_000 - typical) * at) / 1000) * 1000;
    expect(mine.mandate?.opening_paise).toBe(opening);
  });

  it("the worker's own floor above the estimate still wins", async () => {
    const { worker, household, talk } = await pair(kiran(1_500_000), new FakeEstimateApi(byTrade));
    const [job] = await household.device.request(paintNeed(1_700_000), [worker.user]);
    await talk();
    expect((await worker.device.job(job?.engagement.id as EngagementId)).mandate?.limit_paise).toBe(1_500_000);
  });

  it("keeps the city band's rules for details the estimate did not price (pets), and drops the rest", async () => {
    const rules = { ...cook(), rates: BENGALURU_RATES };
    const { worker, household, talk } = await pair(rules, new FakeEstimateApi(byTrade));
    const [job] = await household.device.request(cookNeed(1_300_000, { people: "5", meals: "2", pets: "yes" }), [
      worker.user,
    ]);
    await talk();
    const reasons = (await worker.device.job(job?.engagement.id as EngagementId)).advice?.reasons ?? [];
    expect(reasons).toContainEqual({ kind: ReasonKind.scope, key: "pets", percent: 15 });
    expect(reasons.some((r) => r.kind === ReasonKind.scope && r.key === "people")).toBe(false);
    expect(reasons[0]).toMatchObject({ low_paise: 1_150_000, high_paise: 1_380_000, sources: 3 });
  });

  it("falls back to the city band when there is no estimate, and when the server cannot be reached", async () => {
    for (const answer of [{ none: "too_few_quotes" as const }, new Error("offline")]) {
      const rules = { ...cook(), rates: BENGALURU_RATES };
      const { worker, household, talk } = await pair(rules, new FakeEstimateApi(() => answer));
      const [job] = await household.device.request(cookNeed(1_000_000, { people: "3", meals: "2", pets: "no" }), [
        worker.user,
      ]);
      await talk();
      const mine = await worker.device.job(job?.engagement.id as EngagementId);
      expect(mine.estimate).toBeUndefined();
      expect(mine.advice?.reasons[0]).toEqual({ kind: ReasonKind.band, low_paise: 750000, high_paise: 950000 });
    }
  });

  it("falls back to the worker's own rate with neither an estimate nor a band", async () => {
    const { worker, household, talk } = await pair(kiran(), new FakeEstimateApi(() => ({ none: "unavailable" })));
    const [job] = await household.device.request(paintNeed(1_700_000), [worker.user]);
    await talk();
    const mine = await worker.device.job(job?.engagement.id as EngagementId);
    expect(mine.mandate).toEqual({ opening_paise: 2_000_000, limit_paise: 1_200_000 });
    expect(mine.advice).toBeUndefined();
  });
});

describe("a note on offers far outside the estimate, never a block", () => {
  it("the worker sees the household's low offer flagged; the agents still negotiate to the end", async () => {
    const { worker, household, talk } = await pair(kiran(), new FakeEstimateApi(byTrade));
    const [job] = await household.device.request(paintNeed(900_000), [worker.user]);
    await talk();
    const steps = agentTalk(await worker.device.job(job?.engagement.id as EngagementId));
    const theirs = steps.filter((s) => s.kind === TalkKind.offer && s.by === "requester");
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((s) => s.kind === TalkKind.offer && s.note === OfferNote.below)).toBe(true);
    const own = steps.filter((s) => s.kind === TalkKind.offer && s.by === "provider");
    expect(own.every((s) => s.kind === TalkKind.offer && s.note === undefined)).toBe(true);
  });

  it("the household's job carries the estimate it saw, and flags a worker's offer far above it", async () => {
    const pricey: WorkerRules = { ...kiran(2_500_000), rate: { opening_paise: 3_000_000, limit_paise: 2_500_000 } };
    const { worker, household, talk } = await pair(pricey, new FakeEstimateApi(byTrade));
    const [job] = await household.device.request(paintNeed(1_700_000), [worker.user]);
    await talk();
    const theirs = await household.device.job(job?.engagement.id as EngagementId);
    expect(theirs.estimate).toEqual(PAINT_2BHK);
    const offers = agentTalk(theirs).filter((s) => s.kind === TalkKind.offer && s.by === "provider");
    expect(offers[0]).toMatchObject({ note: OfferNote.above });
  });
});

describe("the share setting", () => {
  it("asks each time until the owner chooses, and ignores a record that is not a choice", async () => {
    const { household } = await pair(kiran(), new FakeEstimateApi(byTrade));
    expect(await sharePrices(household.storage)).toBe(SharePrices.ask);
    await setSharePrices(household.storage, SharePrices.never);
    expect(await household.device.sharePrices()).toBe(SharePrices.never);
    await expect(setSharePrices(household.storage, "sometimes" as SharePrices)).rejects.toThrow();
  });
});
