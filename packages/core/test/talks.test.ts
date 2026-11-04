import { type EngagementId, MENTOR_PROTOCOL, TERMS_PROTOCOL, type TermWhen, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type Clock,
  type NewNeed,
  settle,
  TaskKind,
  type TermPrefs,
  type TimeAsk,
  type WorkerRules,
  whenPassed,
} from "../src/index.js";
import { BENGALURU, electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

/** ADR 0053: the people take over from their agents, decide a time, and never meet a time that has passed. */

const DAY = "2026-11-10";
const NEXT = "2026-11-11";
const morning = { day: DAY, window: "morning" } as const;
/** A week before the 10th: every time in these jobs is still ahead. */
const BEFORE: Clock = { now: () => new Date("2026-11-03T03:30:00Z") };
/** The 10th at half past six in the evening, Indian time (the tests run on it): that morning is over. */
const AFTER_MORNING: Clock = { now: () => new Date(`${DAY}T13:00:00Z`) };

const painter = (terms: TermPrefs): WorkerRules => ({
  trades: [Trade.enum.painter],
  rate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
  base: BENGALURU,
  radius_km: 10,
  terms,
});
const paintNeed = (when: TermWhen): NewNeed => ({
  trade: Trade.enum.painter,
  need: "Paint my 2BHK",
  when: when.day,
  area: { lat: 12.975, lon: 77.645 },
  details: { rooms: "2", labour_only: "yes", day: when.day },
  budget: { opening_paise: 1_300_000, limit_paise: 1_900_000 },
  terms: { when },
});

async function pair(rules: WorkerRules, opts: { clock?: Clock; home?: number; worker?: number; auto?: boolean } = {}) {
  const relay = new MemoryRelay();
  const clock = opts.clock ?? BEFORE;
  const auto = opts.auto ?? true;
  const home = await phone(relay, PRIYA, { protocol: opts.home ?? TERMS_PROTOCOL, autoConfirm: auto, clock });
  const work = await phone(relay, RAVI, {
    protocol: opts.worker ?? TERMS_PROTOCOL,
    autoConfirm: auto,
    worker: rules,
    clock,
  });
  return { home, work, talk: () => settle([home.device, work.device]) };
}

describe("the people take over from their agents", () => {
  it("lets the worker send a final offer after three, which the household's owner accepts", async () => {
    const { home, work, talk } = await pair(electrician(60000));
    const [job] = await home.device.request(fanNeed(45000, { problem: "dead" }), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    expect((await work.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
    // Ravi meets her halfway himself; her agent cannot go above her limit, so she decides.
    await work.device.talks.offer(id, 52000);
    await talk();
    expect((await home.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
    await home.device.talks.acceptTheirs(id);
    await talk();
    const done = await home.device.job(id);
    expect(done.engagement.status).toBe("agreed");
    expect(done.mine?.terms.price_paise).toBe(52000);
    expect([...(await home.device.tasks()), ...(await work.device.tasks())]).toEqual([]);
  });

  it("hands the household's final offer to the worker, who takes it, instead of refusing it by itself", async () => {
    const { home, work, talk } = await pair(electrician(60000));
    const [job] = await home.device.request(fanNeed(45000, { problem: "dead" }), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    // Both owners bargain past their agents: offers four and five each, then the household's last word.
    for (const [side, price] of [
      [work, 56000],
      [home, 47000],
      [work, 52000],
      [home, 49000],
    ] as const) {
      expect((await side.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
      await side.device.talks.offer(id, price);
      await talk();
    }
    // Ravi's agent is below his floor at ₹490 and out of offers: it asks him, it does not end the talk.
    expect((await work.device.job(id)).engagement.status).toBe("negotiating");
    expect((await work.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
    await work.device.talks.acceptTheirs(id);
    await talk();
    expect((await home.device.job(id)).mine?.terms.price_paise).toBe(49000);
  });

  it("refuses an offer of the owner's outside the prices an offer may carry", async () => {
    const { home, work, talk } = await pair(electrician(60000));
    const [job] = await home.device.request(fanNeed(45000, { problem: "dead" }), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    await expect(work.device.talks.offer(id, 0)).rejects.toThrow();
    expect((await work.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
  });

  it("goes on without terms when one phone's answers carry none, instead of talking until no deal", async () => {
    // The worker's phone understands terms; the household's does not, so its counters carry none.
    const { home, work, talk } = await pair(painter({ materials: "worker" }), { home: MENTOR_PROTOCOL });
    const [job] = await home.device.request(paintNeed(morning), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    expect((await work.device.job(id)).terms?.on).toBe(false);
    expect((await home.device.job(id)).engagement.status).toBe("agreed");
  });
});

describe("the household decides the time", () => {
  it("sends a time its owner picks to the worker, who takes it", async () => {
    const { home, work, talk } = await pair(painter({ windows: ["afternoon"] }));
    const [job] = await home.device.request(paintNeed(morning), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    expect(await home.device.store.task(TaskKind.newTime, id)).toBeDefined();
    const picked = { day: NEXT, window: "afternoon" } as const;
    await home.device.talks.pickTime(id, picked);
    await talk();
    const done = await home.device.job(id);
    expect(done.engagement.status).toBe("agreed");
    expect(done.mine?.terms.terms?.when).toEqual(picked);
  });

  it("asks the household for a new time when the offer it takes over is for a time now over", async () => {
    const relay = new MemoryRelay();
    let at = BEFORE.now();
    const clock: Clock = { now: () => at };
    const home = await phone(relay, PRIYA, { protocol: TERMS_PROTOCOL, autoConfirm: true, clock });
    const work = await phone(relay, RAVI, {
      protocol: TERMS_PROTOCOL,
      autoConfirm: true,
      worker: painter({ windows: ["afternoon"] }),
      clock,
    });
    const [job] = await home.device.request(paintNeed(morning), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await settle([home.device, work.device]);
    expect(await home.device.store.task(TaskKind.newTime, id)).toBeDefined();
    // The worker's afternoon goes by before she looks: taking his offer as it stands asks her for a new time.
    at = new Date(`${DAY}T13:00:00Z`);
    await expect(home.device.talks.acceptTime(id)).rejects.toThrow();
    await home.device.talks.acceptTheirs(id);
    const asked = (await home.device.store.task(TaskKind.newTime, id))?.detail as TimeAsk | undefined;
    expect(asked?.passed).toBe(true);
    expect((await home.device.job(id)).engagement.status).not.toBe("agreed");
  });

  it("asks when the time it asked for is over, and the worker never offers one that is", async () => {
    const { home, work, talk } = await pair(painter({ windows: ["morning", "afternoon", "evening"] }), {
      clock: AFTER_MORNING,
    });
    const [job] = await home.device.request(paintNeed(morning), [work.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    const asked = (await home.device.store.task(TaskKind.newTime, id))?.detail as TimeAsk;
    expect(asked.passed).toBe(true);
    expect(asked.when && whenPassed(asked.when, AFTER_MORNING.now())).toBe(false);
    for (const o of (await work.device.job(id)).offers)
      if (o.offer.terms?.when) expect(whenPassed(o.offer.terms.when, AFTER_MORNING.now())).toBe(false);
  });
});
