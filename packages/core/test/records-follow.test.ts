import type { EngagementId, ExportedJob, Payment, PaymentId, UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  endRestored,
  followRecord,
  JobStore,
  jobProgress,
  MemoryStorage,
  nextWorkerStep,
  RestoredJobError,
  recordsDue,
  restoredJob,
  Step,
  stamped,
  withNote,
} from "../src/index.js";
import { FakeRecords } from "./records-fakes.js";

/** A job the phone rebuilt from the record ends through it, the other phone follows it, and both show progress. */

const ME = "usr_01J0000000000000000000ME00" as UserId;
const HOUSEHOLD = "usr_01J0000000000000000000HH00" as UserId;
const JOB = "eng_01J00000000000000000000001" as EngagementId;
const PAID = "pay_01J00000000000000000000001" as PaymentId;
const NOW = new Date("2026-11-01T09:00:00Z");
const LATER = new Date("2026-11-01T09:30:00Z");

const exported = (o: Partial<ExportedJob> = {}): ExportedJob => ({
  engagement: JOB,
  role: "provider",
  counterpart: HOUSEHOLD,
  work: { trade: "cook", scope: { people: "3_4" } },
  terms: { when: { day: "daily", window: "evening" } },
  price_paise: 1_304_000,
  status: "agreed",
  attested: true,
  agreed_at: "2026-10-31T18:00:00Z",
  payments: [],
  ...o,
});

async function storeWith(job = restoredJob(exported(), ME)) {
  const store = new JobStore(new MemoryStorage());
  await store.saveJob(job);
  return { store, job };
}

describe("a restored job ends through the record", () => {
  it("marks it done on this phone, stamped, and owes the record that it is done", async () => {
    const { store, job } = await storeWith();
    const done = await endRestored(store, job, "done", NOW);
    expect(done.engagement.status).toBe("delivered");
    expect(done.history?.at(-1)).toEqual({ status: "delivered", at: NOW.toISOString() });
    expect(recordsDue([done], [])).toEqual([
      expect.objectContaining({ kind: "status", engagement: JOB, body: { status: "done" } }),
    ]);
  });

  it("cancels it too, and refuses a job that is not restored or not under way", async () => {
    const { store, job } = await storeWith();
    expect((await endRestored(store, job, "cancelled", NOW)).engagement.status).toBe("cancelled");
    const closed = restoredJob(exported({ status: "done", done_at: "2026-10-31T20:00:00Z" }), ME);
    await expect(endRestored(store, closed, "done", NOW)).rejects.toThrow(RestoredJobError);
    const { restored: _, ...live } = job;
    await expect(endRestored(store, live, "done", NOW)).rejects.toThrow(RestoredJobError);
  });

  it("owes nothing while the restored job is still under way", () => {
    expect(recordsDue([restoredJob(exported(), ME)], [])).toEqual([]);
  });
});

describe("the other phone follows the record", () => {
  it("moves a job under way to done or cancelled as the record says, and never moves one back", async () => {
    const live = { ...restoredJob(exported(), ME), restored: undefined };
    const { store } = await storeWith(live);
    const api = new FakeRecords();
    api.pages = [{ jobs: [exported({ status: "done", done_at: "2026-11-01T08:00:00Z" })] }];
    expect(await followRecord(api, store, NOW)).toBe(1);
    expect((await store.job(JOB))?.engagement.status).toBe("delivered");
    api.pages = [{ jobs: [exported({ status: "cancelled", cancelled_at: "2026-11-01T08:30:00Z" })] }];
    expect(await followRecord(api, store, LATER)).toBe(0);
    expect((await store.job(JOB))?.engagement.status).toBe("delivered");
  });

  it("leaves jobs the record still has as agreed, and records it does not have here", async () => {
    const { store } = await storeWith();
    const api = new FakeRecords();
    api.pages = [{ jobs: [exported(), exported({ engagement: "eng_01J00000000000000000000009" as EngagementId })] }];
    expect(await followRecord(api, store, NOW)).toBe(0);
  });
});

describe("the progress line", () => {
  const paid: Payment = {
    id: PAID,
    engagement: JOB,
    payee: ME,
    payer: HOUSEHOLD,
    amount_paise: 1_304_000,
    method: "upi",
    status: "confirmed",
    note: "",
    requested_at: "2026-11-01T11:00:00Z",
    paid_at: "2026-11-01T11:05:00Z",
    confirmed_at: "2026-11-01T11:10:00Z",
  };

  it("shows each step with when this phone saw it, from the history and the notes", () => {
    let job = restoredJob(exported(), ME);
    job = withNote(job, { text: "On my way", lang: "en", code: "on_my_way" }, "2026-11-01T09:00:00Z", true);
    job = stamped({ ...job, engagement: { ...job.engagement, status: "in_progress" } }, "2026-11-01T09:00:00Z");
    job = stamped({ ...job, engagement: { ...job.engagement, status: "delivered" } }, "2026-11-01T10:30:00Z");
    expect(jobProgress(job, [paid])).toEqual([
      { step: Step.agreed, reached: true, at: "2026-10-31T18:00:00Z" },
      { step: Step.on_my_way, reached: true, at: "2026-11-01T09:00:00Z" },
      { step: Step.done, reached: true, at: "2026-11-01T10:30:00Z" },
      { step: Step.paid, reached: true, at: "2026-11-01T11:10:00Z" },
      { step: Step.closed, reached: false },
    ]);
  });

  it("ends a cancelled job's line where it stopped, and has none before both have signed", () => {
    const job = restoredJob(exported({ status: "cancelled", cancelled_at: "2026-11-01T07:00:00Z" }), ME);
    expect(jobProgress(job, [])).toEqual([
      { step: Step.agreed, reached: true, at: "2026-10-31T18:00:00Z" },
      { step: Step.cancelled, reached: true, at: "2026-11-01T07:00:00Z" },
    ]);
    const { restored: _, ...unsigned } = job;
    expect(jobProgress(unsigned, [])).toBeUndefined();
  });
});

describe("the worker's next step", () => {
  const at = "2026-11-01T09:00:00Z";
  const withStatus = (job: ReturnType<typeof restoredJob>, status: "in_progress" | "delivered") =>
    stamped({ ...job, engagement: { ...job.engagement, status } }, at);

  it("is on the way, then arrived and started, then done: one at a time, in order", () => {
    let job = restoredJob(exported(), ME);
    expect(nextWorkerStep(job)).toBe("on_my_way");
    job = withStatus(withNote(job, { text: "On my way", lang: "en", code: "on_my_way" }, at, true), "in_progress");
    expect(nextWorkerStep(job)).toBe("started");
    job = withNote(job, { text: "Started work", lang: "en", code: "started" }, at, true);
    expect(nextWorkerStep(job)).toBe("done");
    expect(nextWorkerStep(withStatus(job, "delivered"))).toBeUndefined();
  });

  it("does not skip 'on my way' when a free-text note moved the job on", () => {
    const job = withStatus(
      withNote(restoredJob(exported(), ME), { text: "Reaching at 10", lang: "en" }, at, true),
      "in_progress",
    );
    expect(nextWorkerStep(job)).toBe("on_my_way");
  });
});
