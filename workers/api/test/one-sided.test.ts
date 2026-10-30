import { HttpMethod } from "@gigsync/core";
import { JobSubmitState, type MyJobRecords, RecordRefusal } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { ADMIN_HEADER, ADMIN_KEY, call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";
import {
  asHousehold,
  asWorker,
  cardOf,
  consented,
  deliverAgree,
  newEngagement,
  newHash,
  paintJob,
  stateOf,
  workerCard,
} from "./record-helpers.js";

const S = JobSubmitState.enum;

async function exportOf(as: Person): Promise<MyJobRecords> {
  const res = await call(as, HttpMethod.get, "/jobs/records/mine");
  expect(res.status).toBe(200);
  return res.json();
}

/** A real job only the worker sent: the household signed (its agree reached her) but declined the notice. */
async function oneSided(w: Person, home: Person, price?: number) {
  const job = paintJob(newEngagement(), newHash(), price);
  await deliverAgree(home, w, job.engagement);
  expect(await stateOf(await asWorker(w, home, job))).toBe(S.one_sided);
  return job;
}

describe("one-sided jobs: only the worker's side reached the server", () => {
  it("count on her record, came back included, once the household's agree was delivered, without its consent", async () => {
    const w = await consented("+919888350001");
    await w.api.publishProfile(workerCard("Ugramma"));
    const home = await signIn("+919888350002");
    await oneSided(w, home);
    await oneSided(w, home);
    expect((await cardOf(home, w.session.user)).record).toEqual({ jobs: 2, rated: 0, came_back: 1 });
    const { jobs } = await exportOf(w);
    expect(jobs.map((j) => [j.attested, j.counterpart])).toEqual([
      [false, home.session.user],
      [false, home.session.user],
    ]);
  });

  it("never come from an invented job naming someone who never signed it", async () => {
    const w = await consented("+919888350014");
    await w.api.publishProfile(workerCard("Yallappa"));
    const stranger = await signIn("+919888350015");
    const invented = paintJob(newEngagement(), newHash());
    expect(await stateOf(await asWorker(w, stranger, invented))).toBe(S.pending);
    // Her own agree to them, or their agree on another engagement, proves nothing about this one.
    await deliverAgree(w, stranger, invented.engagement);
    await deliverAgree(stranger, w, newEngagement());
    expect(await stateOf(await asWorker(w, stranger, invented))).toBe(S.pending);
    expect((await exportOf(w)).jobs).toEqual([]);
    expect(await cardOf(stranger, w.session.user)).not.toHaveProperty("record");
  });

  it("are upgraded from waiting when the household's agree arrives after the submission", async () => {
    const w = await consented("+919888350016");
    const home = await signIn("+919888350017");
    const job = paintJob(newEngagement(), newHash());
    expect(await stateOf(await asWorker(w, home, job))).toBe(S.pending);
    await deliverAgree(home, w, job.engagement);
    expect((await exportOf(w)).jobs).toMatchObject([{ engagement: job.engagement, attested: false }]);
    // Delivering the same agree again changes nothing.
    await deliverAgree(home, w, job.engagement);
    expect((await exportOf(w)).jobs).toHaveLength(1);
    expect(await stateOf(await asWorker(w, home, job))).toBe(S.one_sided);
  });

  it("never come from a household's submission alone", async () => {
    const w = await consented("+919888350003");
    const home = await consented("+919888350004");
    const job = paintJob(newEngagement(), newHash());
    await deliverAgree(w, home, job.engagement);
    expect(await stateOf(await asHousehold(home, w, job))).toBe(S.pending);
    expect((await exportOf(home)).jobs).toEqual([]);
    expect((await exportOf(w)).jobs).toEqual([]);
  });

  it("become attested when the household's matching side arrives, keeping status and payments", async () => {
    const w = await consented("+919888350005");
    const home = await consented("+919888350006");
    const job = await oneSided(w, home);
    const path = `/jobs/records/${job.engagement}`;
    expect((await call(w, HttpMethod.post, `${path}/status`, { status: "done" })).status).toBe(200);
    const p = { payment: `pay_${ulid()}`, amount_paise: 900000, paid_on: "2026-11-02", method: "upi" };
    expect((await call(w, HttpMethod.post, `${path}/payments`, p)).status).toBe(201);
    expect(await stateOf(await asHousehold(home, w, job))).toBe(S.stored);
    const [stored] = (await exportOf(w)).jobs;
    expect(stored).toMatchObject({ attested: true, status: "done", payments: [{ ...p, confirmed: true }] });
  });

  it("are withdrawn, payments and all, when the household's side differs", async () => {
    const w = await consented("+919888350007");
    await w.api.publishProfile(workerCard("Veeresha"));
    const home = await consented("+919888350008");
    const job = await oneSided(w, home, 950000);
    const p = { payment: `pay_${ulid()}`, amount_paise: 950000, paid_on: "2026-11-02", method: "cash" };
    await call(w, HttpMethod.post, `/jobs/records/${job.engagement}/payments`, p);
    expect(await stateOf(await asHousehold(home, w, { ...job, price_paise: 900000 }))).toBe(S.mismatch);
    expect((await exportOf(w)).jobs).toEqual([]);
    expect(await cardOf(home, w.session.user)).not.toHaveProperty("record");
    // The worker's correction then matches, and the job is attested.
    expect(await stateOf(await asWorker(w, home, { ...job, price_paise: 900000 }))).toBe(S.stored);
  });

  it("can be corrected by their worker, but never taken over by another worker", async () => {
    const w = await consented("+919888350009");
    const home = await signIn("+919888350010");
    const rival = await consented("+919888350011");
    const job = await oneSided(w, home, 950000);
    expect(await stateOf(await asWorker(w, home, { ...job, price_paise: 900000 }))).toBe(S.one_sided);
    expect((await exportOf(w)).jobs[0]?.price_paise).toBe(900000);
    // The household's agree went to her, not the rival: the rival's side waits.
    expect(await stateOf(await asWorker(rival, home, job))).toBe(S.pending);
    await deliverAgree(home, rival, job.engagement);
    const res = await asWorker(rival, home, job);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: RecordRefusal.enum.record_differs });
    expect((await exportOf(rival)).jobs).toEqual([]);
  });

  it("are counted in analytics with how many were one-sided", async () => {
    const w = await consented("+919888350012");
    const home = await consented("+919888350013");
    await oneSided(w, home);
    const both = paintJob(newEngagement(), newHash());
    await asWorker(w, home, both);
    await asHousehold(home, w, both);
    const path = "/admin/analytics/earnings?from=2026-11&to=2026-11";
    const res = await call(w, HttpMethod.get, path, undefined, { [ADMIN_HEADER]: ADMIN_KEY });
    const { rows } = (await res.json()) as { rows: { worker: string }[] };
    expect(rows.filter((r) => r.worker === w.session.user)).toEqual([
      { worker: w.session.user, month: "2026-11", jobs: 2, one_sided: 1, revenue_paise: 0 },
    ]);
  });
});
