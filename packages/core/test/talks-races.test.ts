import {
  type EngagementId,
  MAX_ROUNDS,
  OWNER_OFFERS_PROTOCOL,
  ROUNDS_BEFORE_OWNERS,
  type TermWhen,
  Trade,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type Clock, settle, TalkError, TaskKind, type WorkerRules } from "../src/index.js";
import type { JobContext } from "../src/job/context.js";
import { askTime, withRounds } from "../src/job/handover.js";
import type { JobRecord } from "../src/job/store.js";
import { BENGALURU, electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

/** ADR 0053 §4: two owners acting at once settle on one deal, and an unanswered directory loses no decision. */

const DAY = "2026-11-10";
const morning: TermWhen = { day: DAY, window: "morning" };

async function pair(rules: WorkerRules, clock?: Clock) {
  const relay = new MemoryRelay();
  const opts = { protocol: OWNER_OFFERS_PROTOCOL, autoConfirm: true, ...(clock ? { clock } : {}) };
  const home = await phone(relay, PRIYA, opts);
  const work = await phone(relay, RAVI, { ...opts, worker: rules });
  return { home, work, talk: () => settle([home.device, work.device]) };
}

/** Five offers each and no deal: the worker decides, the household waits on him. */
async function stuck(rules = electrician(60000), clock?: Clock) {
  const p = await pair(rules, clock);
  const [job] = await p.home.device.request(fanNeed(45000, { problem: "dead" }), [p.work.user]);
  const id = job?.engagement.id as EngagementId;
  await p.talk();
  return { ...p, id };
}

describe("both owners acting at once", () => {
  it("settles on the later offer when each owner accepts the other's at the same moment", async () => {
    const { home, work, talk, id } = await stuck();
    // She takes his fifth; he takes her fifth, the later offer; neither has heard from the other yet.
    await home.device.talks.acceptTheirs(id);
    await work.device.talks.acceptTheirs(id);
    await talk();
    const [hers, his] = [await home.device.job(id), await work.device.job(id)];
    expect([hers.engagement.status, his.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(hers.mine?.terms_hash).toBe(his.mine?.terms_hash);
    expect(hers.mine?.terms.offer_id).toBe(hers.offers.at(-1)?.offer.offer_id);
    expect([...(await home.device.tasks()), ...(await work.device.tasks())]).toEqual([]);
  });

  it("keeps her signature when his own new offer crosses it, and both agree on what she signed", async () => {
    const { home, work, talk, id } = await stuck();
    const signedFor = (await home.device.job(id)).offers.filter((o) => o.by === "provider").at(-1)?.offer.offer_id;
    await home.device.talks.acceptTheirs(id);
    // Inside her limit: her agent would take it, and sign over the signature she already sent.
    await work.device.talks.offer(id, 44000);
    await talk();
    const [hers, his] = [await home.device.job(id), await work.device.job(id)];
    expect([hers.engagement.status, his.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(hers.mine?.terms_hash).toBe(his.mine?.terms_hash);
    expect(hers.mine?.terms.offer_id).toBe(signedFor);
  });

  it("refuses a waiting household his offer at a time now over, and leaves her waiting", async () => {
    let at = new Date("2026-11-03T03:30:00Z");
    const clock: Clock = { now: () => at };
    const painter: WorkerRules = {
      trades: [Trade.enum.painter],
      rate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
      base: BENGALURU,
      radius_km: 10,
      terms: { windows: ["morning"] },
    };
    const p = await pair(painter, clock);
    const [job] = await p.home.device.request(
      {
        trade: Trade.enum.painter,
        need: "Paint my 2BHK",
        when: DAY,
        area: { lat: 12.975, lon: 77.645 },
        details: { rooms: "2", labour_only: "yes", day: DAY },
        budget: { opening_paise: 300_000, limit_paise: 500_000 },
        terms: { when: morning },
      },
      [p.work.user],
    );
    const id = job?.engagement.id as EngagementId;
    await p.talk();
    expect((await p.home.device.tasks()).map((t) => t.detail)).toEqual([{ waiting: true }]);
    at = new Date(`${DAY}T13:00:00Z`);
    await expect(p.home.device.talks.acceptTheirs(id)).rejects.toThrow(TalkError);
    expect((await p.home.device.tasks()).map((t) => [t.kind, t.detail])).toEqual([
      [TaskKind.takeOver, { waiting: true }],
    ]);
  });
});

describe("a time that passes while nobody writes", () => {
  it("goes to the household on its turn, replacing the decision it had", async () => {
    let at = new Date("2026-11-03T03:30:00Z");
    const clock: Clock = { now: () => at };
    const painter: WorkerRules = {
      trades: [Trade.enum.painter],
      rate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
      base: BENGALURU,
      radius_km: 10,
      terms: { windows: ["morning"] },
    };
    const p = await pair(painter, clock);
    const [job] = await p.home.device.request(
      {
        trade: Trade.enum.painter,
        need: "Paint my 2BHK",
        when: DAY,
        area: { lat: 12.975, lon: 77.645 },
        details: { rooms: "2", labour_only: "yes", day: DAY },
        budget: { opening_paise: 300_000, limit_paise: 500_000 },
        terms: { when: morning },
      },
      [p.work.user],
    );
    const id = job?.engagement.id as EngagementId;
    await p.talk();
    // His own offer makes it her turn: she has the decision, for the morning of the 10th.
    await p.work.device.talks.offer(id, 1_500_000);
    await p.talk();
    expect((await p.home.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
    at = new Date(`${DAY}T13:00:00Z`);
    await p.home.device.sync();
    expect((await p.home.device.tasks()).map((t) => [t.kind, t.detail])).toEqual([
      [TaskKind.newTime, { passed: true }],
    ]);
    // Once asked, it is not asked again.
    await p.home.device.sync();
    expect(await p.home.device.tasks()).toHaveLength(1);
  });
});

describe("the offers the other phone takes", () => {
  const record = (offers_made: number) => ({ offers_made, engagement: { counterpart: RAVI } }) as unknown as JobRecord;

  it("stays unknown, not lost, when the directory does not answer", async () => {
    const ctx = { speaks: () => Promise.reject(new Error("503")) } as unknown as JobContext;
    const r = record(5);
    expect(await withRounds(ctx, r)).toBe(r);
  });

  it("is learnt when the household is asked a time after its agent's offers too", async () => {
    const saved: JobRecord[] = [];
    const ctx = {
      speaks: async (_: unknown, n: number) => n <= OWNER_OFFERS_PROTOCOL,
      clock: { now: () => new Date() },
      store: { saveJob: async (r: JobRecord) => void saved.push(r), addTask: async () => undefined },
    } as unknown as JobContext;
    const r = { ...record(5), engagement: { id: "eng_1", counterpart: RAVI } } as unknown as JobRecord;
    expect((await askTime(ctx, r, { passed: true })).rounds).toBe(MAX_ROUNDS);
    expect(saved.at(-1)?.rounds).toBe(MAX_ROUNDS);
    expect((await withRounds(ctx, record(4))).rounds).toBeUndefined();
    expect(ROUNDS_BEFORE_OWNERS).toBeLessThan(MAX_ROUNDS);
  });
});
