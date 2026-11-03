import { describe, expect, it } from "vitest";
import { doesWork, jobWork, settle, TaskKind, type WorkerRules } from "../src/index.js";
import { BENGALURU, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

const tailor = { text: "Tailor", lang: "en" } as const;

/** A worker who lists only a skill of her own (ADR 0047). */
const tailoring = (min = 50000, rate = 70000): WorkerRules => ({
  trades: [],
  skills: [tailor],
  rate: { opening_paise: rate, limit_paise: min },
  base: BENGALURU,
  radius_km: 10,
});

const blouses = (budget: number, skill = tailor) => ({
  trade: "other" as const,
  skill,
  need: "Tailor",
  when: "tomorrow 10:00",
  area: { lat: 12.975, lon: 77.645 },
  details: { job: "Stitch two blouses" },
  budget: { opening_paise: Math.round(budget * 0.7), limit_paise: budget },
});

describe("a job for a skill outside the trades", () => {
  it("is taken only by a worker whose card lists that skill, by its key", () => {
    expect(doesWork(tailoring(), { trade: "other", skill: { text: " TAILOR", lang: "hi" } })).toBe(true);
    expect(doesWork(tailoring(), { trade: "other", skill: { text: "Garden work", lang: "en" } })).toBe(false);
    expect(doesWork(tailoring(), { trade: "cook" })).toBe(false);
    expect(doesWork({ trades: ["cook"] }, { trade: "other", skill: tailor })).toBe(false);
  });

  it("asks how long, quotes from the worker's own rates, and is recorded without words", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: tailoring() });
    const household = await phone(relay, PRIYA);
    const [job] = await household.device.request(blouses(65000), [worker.user]);
    const id = job?.engagement.id as never;

    await settle([household.device, worker.device]);
    // The household said what the work is; the worker's agent asks only the other generic question.
    const asked = await household.device.job(id);
    expect(asked.questions?.map((q) => q.key)).toEqual(["duration"]);
    expect(asked.estimate).toBeUndefined();
    await household.device.answer(id, { duration: "Two days" });
    await settle([household.device, worker.device]);

    const tasks = [...(await household.device.tasks()), ...(await worker.device.tasks())];
    expect(tasks.map((t) => t.kind)).toEqual([TaskKind.confirmDeal]);
    for (const p of [household, worker]) {
      if ((await p.device.tasks()).length > 0) await p.device.confirmDeal(id);
      await settle([household.device, worker.device]);
    }
    for (const p of [household, worker]) {
      if ((await p.device.tasks()).length > 0) await p.device.confirmDeal(id);
      await settle([household.device, worker.device]);
    }
    const h = await household.device.job(id);
    const w = await worker.device.job(id);
    expect([h.engagement.status, w.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(h.mine?.terms.trade).toBe("other");
    expect(h.mine?.terms.price_paise).toBeGreaterThanOrEqual(50000);
    expect(h.mine?.terms.price_paise).toBeLessThanOrEqual(65000);
    expect(w.request.skill).toEqual(tailor);
    // The server's record of the job keeps no skill words and no scope.
    expect(jobWork(w as never)).toEqual({ trade: "other", scope: {} });
  });

  it("is declined by a worker who does not list it", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: tailoring() });
    const household = await phone(relay, PRIYA);
    const [job] = await household.device.request(blouses(65000, { text: "Garden work", lang: "en" }), [worker.user]);
    await settle([household.device, worker.device]);
    const h = await household.device.job(job?.engagement.id as never);
    expect(h.engagement.status).toBe("declined");
    expect(h.cancel?.reason).toBe("no_match");
  });
});
