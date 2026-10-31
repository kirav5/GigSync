import type { EngagementId, ExportedJob, PaymentId, UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  applyMerge,
  Collection,
  GONE_COUNTERPART,
  hasHistory,
  JobStore,
  MemoryStorage,
  MergeChoice,
  passbook,
  planMerge,
  receiptsOf,
  recordsDue,
  restoredJob,
  restoredPayments,
  restoreFromRecord,
  workRecord,
} from "../src/index.js";
import { FakeRecords } from "./records-fakes.js";

const ME = "usr_01J0000000000000000000ME00" as UserId;
const HOUSEHOLD = "usr_01J0000000000000000000HH00" as UserId;
const [FIRST, SECOND, THIRD] = [
  "eng_01J00000000000000000000001",
  "eng_01J00000000000000000000002",
  "eng_01J00000000000000000000003",
] as EngagementId[];
const PAID = "pay_01J00000000000000000000001" as PaymentId;
const NOW = new Date("2026-10-31T09:00:00Z");
const IST = 330;

const exported = (o: Partial<ExportedJob> = {}): ExportedJob => ({
  engagement: FIRST as EngagementId,
  role: "provider",
  counterpart: HOUSEHOLD,
  work: { trade: "cook", scope: { people: "3_4", meals: "2" } },
  terms: { when: { day: "daily", window: "morning" } },
  price_paise: 950_000,
  status: "done",
  attested: true,
  agreed_at: "2026-10-03T09:00:00Z",
  done_at: "2026-10-28T09:00:00Z",
  stars: 5,
  payments: [{ payment: PAID, amount_paise: 950_000, paid_on: "2026-10-04", method: "upi", confirmed: true }],
  ...o,
});

describe("a job restored from the record", () => {
  it("keeps the structured facts, its payment and stars, and no words, offers or contact", () => {
    const r = restoredJob(exported(), ME);
    expect(r.engagement).toMatchObject({ id: FIRST, role: "provider", counterpart: HOUSEHOLD, status: "closed" });
    expect(r.request).toMatchObject({ trade: "cook", need: "", details: { day: "daily" } });
    expect(r.review).toEqual({ stars: 5, text: "" });
    expect([r.contact, r.mine, r.theirs, r.offers]).toEqual([undefined, undefined, undefined, []]);
    expect(restoredPayments([r])).toEqual([
      expect.objectContaining({ id: PAID, payee: ME, payer: HOUSEHOLD, status: "confirmed", amount_paise: 950_000 }),
    ]);
  });

  it("names nobody once the household deleted their records, and its unconfirmed payment waits", () => {
    const r = restoredJob(exported({ role: "requester", counterpart: null, status: "agreed", stars: undefined }), ME);
    expect(r.engagement).toMatchObject({ counterpart: GONE_COUNTERPART, status: "agreed" });
    const unconfirmed = exported({ role: "requester", payments: [{ ...exported().payments[0], confirmed: false }] });
    expect(restoredPayments([restoredJob(unconfirmed, ME)])[0]).toMatchObject({ payer: ME, status: "paid" });
  });

  it("counts on the worker's passbook and record, and on the household's Records", () => {
    const worker = [restoredJob(exported(), ME)];
    expect(passbook(worker, restoredPayments(worker), ME, NOW, IST).rows).toHaveLength(1);
    const record = workRecord(worker, restoredPayments(worker), ME, NOW, IST);
    expect([record.jobs, record.months[0]?.rows[0]?.price_paise, record.months[0]?.rows[0]?.state]).toEqual([
      1,
      950_000,
      "received",
    ]);
    const household = [restoredJob(exported({ role: "requester" }), ME)];
    expect(receiptsOf(household, restoredPayments(household), ME)).toHaveLength(1);
  });

  it("is never sent to GigSync again", () => {
    const jobs = [restoredJob(exported(), ME)];
    expect(recordsDue(jobs, restoredPayments(jobs))).toEqual([]);
  });
});

describe("refilling a new phone from the record", () => {
  it("adds every job of every page to a phone with none", async () => {
    const api = new FakeRecords();
    api.pages = [
      { jobs: [exported()], next: FIRST },
      { jobs: [exported({ engagement: SECOND, status: "cancelled" })] },
    ];
    const store = new JobStore(new MemoryStorage());
    expect(await restoreFromRecord(api, store, ME)).toBe(2);
    expect((await store.jobs()).map((j) => [j.engagement.id, j.engagement.status, !!j.restored])).toEqual([
      [FIRST, "closed", true],
      [SECOND, "cancelled", true],
    ]);
    expect(api.asked[1]).toMatchObject({ after: FIRST });
  });

  it("never touches a phone that already has jobs, such as one the move brought", async () => {
    const api = new FakeRecords();
    api.pages = [{ jobs: [exported(), exported({ engagement: THIRD })] }];
    const store = new JobStore(new MemoryStorage());
    const moved = {
      ...restoredJob(exported(), ME),
      restored: undefined,
      request: { ...restoredJob(exported(), ME).request, need: "Morning cook" },
    };
    await store.saveJob(moved);
    expect(await restoreFromRecord(api, store, ME)).toBe(0);
    expect(await store.jobs()).toEqual([moved]);
    expect(api.asked).toEqual([]);
  });

  it("leaves the phone still asking whether the owner is moving: restored jobs are not history", async () => {
    const storage = new MemoryStorage();
    await new JobStore(storage).saveJob(restoredJob(exported(), ME));
    expect(await hasHistory(storage)).toBe(false);
    await new JobStore(storage).saveJob({ ...restoredJob(exported({ engagement: SECOND }), ME), restored: undefined });
    expect(await hasHistory(storage)).toBe(true);
  });

  it("gives way to the old phone's full copy when the owner moves afterwards", async () => {
    const storage = new MemoryStorage();
    const restored = restoredJob(exported(), ME);
    await new JobStore(storage).saveJob(restored);
    const full = { ...restored, restored: undefined, request: { ...restored.request, need: "Morning cook" } };
    const plan = await planMerge(storage, { [Collection.jobs]: [{ id: FIRST, value: full }] });
    expect([plan.add.length, plan.conflicts.length]).toEqual([1, 0]);
    await applyMerge(storage, plan, MergeChoice.keepMine);
    expect((await new JobStore(storage).job(FIRST as EngagementId))?.request.need).toBe("Morning cook");
  });
});
