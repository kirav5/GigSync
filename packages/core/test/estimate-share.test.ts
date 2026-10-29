import { type EngagementId, type EstimateRequest, Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type JobRecord,
  type NewNeed,
  ShareAnswer,
  SharePrices,
  setSharePrices,
  settle,
  shareDue,
  sharedPriceOf,
  type WorkerRules,
} from "../src/index.js";
import { estimateOptions, FakeEstimateApi, PAINT_2BHK } from "./estimate-fixtures.js";
import { ASHA, BENGALURU, MemoryRelay, phone, RAVI_HOME } from "./phones.js";

const T = Trade.enum;
const answers = (r: EstimateRequest) => (r.trade === T.painter ? PAINT_2BHK : { none: "too_few_quotes" as const });
const painter: WorkerRules = {
  trades: [T.painter],
  rate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
  base: BENGALURU,
  radius_km: 10,
};
const need = (details: Record<string, string>): NewNeed => ({
  trade: T.painter,
  need: "Paint my 2BHK, call me on 9800000404",
  when: "next week",
  area: { lat: 12.975, lon: 77.645 },
  details,
  budget: { opening_paise: 1_200_000, limit_paise: 1_800_000 },
});

/** Both sides sign a painting job; returns the phones, the fake API and the job's id. */
async function signed(details: Record<string, string> = { rooms: "2", labour_only: "yes" }) {
  // Everything the worker's agent would ask is given up front, so the agents go straight to a price.
  const relay = new MemoryRelay();
  const api = new FakeEstimateApi(answers);
  const estimates = estimateOptions(api);
  const worker = await phone(relay, ASHA, { worker: painter, lang: Lang.enum.hi, estimates });
  const household = await phone(relay, RAVI_HOME, { lang: Lang.enum.kn, estimates });
  const talk = () => settle([household.device, worker.device]);
  const [job] = await household.device.request(need(details), [worker.user]);
  const id = job?.engagement.id as EngagementId;
  await talk();
  for (let turn = 0; turn < 2; turn++) {
    for (const p of [worker, household]) if ((await p.device.tasks()).length) await p.device.confirmDeal(id);
    await talk();
  }
  return { worker, household, api, id, talk };
}

describe("sharing a signed price anonymously, by consent", () => {
  it("offers each owner the price once both signed; yes sends only trade, city, area, bucket, price and month", async () => {
    const { worker, household, api, id } = await signed();
    const job = await household.device.job(id);
    expect(shareDue(job)).toBe(true);
    expect(shareDue(await worker.device.job(id))).toBe(true);
    // Asked each time by default: nothing has gone anywhere yet.
    expect(api.shared).toEqual([]);

    const after = await household.device.answerShare(id, true);
    expect(after.price_share).toBe(ShareAnswer.yes);
    expect(api.shared).toHaveLength(1);
    const sent = api.shared[0];
    expect(Object.keys(sent ?? {}).sort()).toEqual(["area_key", "city", "month", "price_paise", "scope", "trade"]);
    expect(sent).toMatchObject({
      city: "bengaluru",
      trade: T.painter,
      scope: { rooms: "bhk2", labour_only: "yes" },
      area_key: "hsr-layout",
      price_paise: job.mine?.terms.price_paise,
    });
    expect(sent?.month).toMatch(/^\d{4}-\d{2}$/);
    // No words, names or numbers ride along.
    expect(JSON.stringify(sent)).not.toMatch(/9800000404|Ravi|Asha|Paint my/);
    // Asked once: a second yes sends nothing more.
    await household.device.answerShare(id, true);
    expect(api.shared).toHaveLength(1);
    expect(shareDue(after)).toBe(false);
  });

  it("no sends nothing and is not asked again", async () => {
    const { worker, api, id } = await signed();
    const after = await worker.device.answerShare(id, false);
    expect(after.price_share).toBe(ShareAnswer.no);
    expect(api.shared).toEqual([]);
    expect(shareDue(after)).toBe(false);
  });

  it("a send that fails leaves the job unanswered, to ask again", async () => {
    const { household, api, id } = await signed();
    api.failShares = true;
    await expect(household.device.answerShare(id, true)).rejects.toThrow();
    expect(shareDue(await household.device.job(id))).toBe(true);
  });

  it("a job the buckets cannot hold (painting with no rooms) is never sent, and recorded as not shared", async () => {
    const { household, api, id } = await signed();
    const before = await household.device.job(id);
    const job = { ...before, request: { ...before.request, details: { area_sqft: "900", labour_only: "yes" } } };
    await household.device.store.saveJob(job);
    expect(sharedPriceOf(job, estimateOptions(api), new Date())).toBeUndefined();
    expect((await household.device.answerShare(id, true)).price_share).toBe(ShareAnswer.no);
    expect(api.shared).toEqual([]);
  });

  it("Always shares on the next sync without asking; Never marks the job not shared", async () => {
    const { worker, household, api, id, talk } = await signed();
    await setSharePrices(household.storage, SharePrices.always);
    await setSharePrices(worker.storage, SharePrices.never);
    await talk();
    expect((await household.device.job(id)).price_share).toBe(ShareAnswer.yes);
    expect((await worker.device.job(id)).price_share).toBe(ShareAnswer.no);
    expect(api.shared).toHaveLength(1);
  });

  it("a job not signed by both is never offered", async () => {
    const relay = new MemoryRelay();
    const api = new FakeEstimateApi(answers);
    const household = await phone(relay, RAVI_HOME, { estimates: estimateOptions(api) });
    const worker = await phone(relay, ASHA, { worker: painter, estimates: estimateOptions(api) });
    const [job] = await household.device.request(need({ rooms: "2", labour_only: "yes" }), [worker.user]);
    const first = job as JobRecord;
    expect(shareDue(first)).toBe(false);
    expect((await household.device.answerShare(first.engagement.id, true)).price_share).toBeUndefined();
    expect(api.shared).toEqual([]);
  });
});
