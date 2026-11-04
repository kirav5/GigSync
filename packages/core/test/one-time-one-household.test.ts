import { type EngagementId, TERMS_PROTOCOL, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type Clock,
  type NewNeed,
  settle,
  TaskKind,
  type TimeAsk,
  type TimeWindow,
  type WorkerRules,
} from "../src/index.js";
import { ASHA, BENGALURU, MemoryRelay, type Phone, PRIYA, phone, RAVI_HOME } from "./phones.js";

/**
 * One time, one household (ADR 0048 §5): two households asking a worker for the same morning never both get it. The
 * first to sign does; the other is offered the worker's next free time, or told no when there is none.
 */

const DAY = "2026-11-10";
/** The phones' clock: a week before, so the 10th and the days after stay ahead (ADR 0053 §2). */
const BEFORE: Clock = { now: () => new Date("2026-11-03T03:30:00Z") };
const morning = { day: DAY, window: "morning" } as const;
const painter = (windows: TimeWindow[]): WorkerRules => ({
  trades: [Trade.enum.painter],
  rate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
  base: BENGALURU,
  radius_km: 10,
  terms: { windows },
});
const paintNeed = (): NewNeed => ({
  trade: Trade.enum.painter,
  need: "Paint my 2BHK",
  when: DAY,
  area: { lat: 12.975, lon: 77.645 },
  details: { rooms: "2", labour_only: "yes", day: DAY },
  budget: { opening_paise: 1_300_000, limit_paise: 1_900_000 },
  terms: { when: morning },
});

async function twoHouseholds(rules: WorkerRules, workerSigns: boolean) {
  const relay = new MemoryRelay();
  const opts = { protocol: TERMS_PROTOCOL, autoConfirm: true, clock: BEFORE };
  const homes = [await phone(relay, PRIYA, opts), await phone(relay, RAVI_HOME, opts)];
  const worker = await phone(relay, ASHA, {
    protocol: TERMS_PROTOCOL,
    autoConfirm: workerSigns,
    worker: rules,
    clock: BEFORE,
  });
  const ids: EngagementId[] = [];
  for (const home of homes) {
    const [job] = await home.device.request(paintNeed(), [worker.user]);
    ids.push(job?.engagement.id as EngagementId);
  }
  const talk = () => settle([...homes.map((h) => h.device), worker.device]);
  const jobs = () => Promise.all(ids.map((id) => worker.device.job(id)));
  return { homes, worker, ids, talk, jobs };
}

/** Which household is asked about a time, by its index; -1 when none is. */
async function whoIsAsked(homes: readonly Phone[], ids: readonly EngagementId[]): Promise<number> {
  for (let i = 0; i < homes.length; i++)
    if (await homes[i]?.device.store.task(TaskKind.newTime, ids[i] as EngagementId)) return i;
  return -1;
}

/** The windows of the worker's jobs both sides signed. */
const agreedWindows = (jobs: Awaited<ReturnType<Awaited<ReturnType<typeof twoHouseholds>>["jobs"]>>) =>
  jobs.filter((j) => j.engagement.status === "agreed").map((j) => j.mine?.terms.terms?.when?.window);

describe("one time, one household", () => {
  it("signs the morning for the first household and offers the second the afternoon", async () => {
    const { homes, ids, talk, jobs } = await twoHouseholds(painter(["morning", "afternoon"]), true);
    await talk();
    // The second household's agent was offered another time than its owner asked for: its owner signs it.
    const second = homes[1];
    if (await second?.device.store.task(TaskKind.confirmDeal, ids[1] as EngagementId)) {
      await second?.device.confirmDeal(ids[1] as EngagementId);
      await talk();
    }
    const windows = agreedWindows(await jobs());
    expect(windows).toContain("morning");
    expect(new Set(windows).size).toBe(windows.length);
  });

  it("with the worker signing by hand, the second deal for the morning leaves their list once they sign the first", async () => {
    const { worker, ids, talk, jobs } = await twoHouseholds(painter(["morning", "afternoon"]), false);
    await talk();
    const waiting = async () =>
      (await worker.device.tasks()).filter((t) => t.kind === TaskKind.confirmDeal).map((t) => t.engagement);
    expect((await waiting()).sort()).toEqual([...ids].sort());
    await worker.device.confirmDeal(ids[0] as EngagementId);
    // The other morning deal is offered at another time at once: there is nothing left to sign twice.
    expect(await waiting()).not.toContain(ids[1]);
    await talk();
    expect(agreedWindows(await jobs()).filter((w) => w === "morning")).toHaveLength(1);
  });

  it("asks the second household about the worker's next free morning, and ends it when she says no", async () => {
    const { homes, ids, talk, jobs } = await twoHouseholds(painter(["morning"]), true);
    await talk();
    // One morning is signed; the other household is asked about another morning (ADR 0053 §3), never given it.
    const asked = await whoIsAsked(homes, ids);
    expect(asked).toBeGreaterThanOrEqual(0);
    const task = await homes[asked]?.device.store.task(TaskKind.newTime, ids[asked] as EngagementId);
    const proposed = (task?.detail as TimeAsk | undefined)?.when;
    expect(proposed?.day).toBeDefined();
    expect(proposed?.day).not.toBe(DAY);
    await homes[asked]?.device.talks.end(ids[asked] as EngagementId);
    await talk();
    const [first, second] = await jobs();
    expect([first?.engagement.status, second?.engagement.status].filter((s) => s === "agreed")).toHaveLength(1);
    expect([first, second].some((j) => j?.cancel !== undefined)).toBe(true);
  });
});
