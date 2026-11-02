import { HttpMethod } from "@gigsync/core";
import { type MyJobRecords, RECORDS_NOTICE_VERSION, Role } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { ADMIN_HEADER, ADMIN_KEY, call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";
import {
  asHousehold,
  asWorker,
  cardOf,
  consented,
  doneJob,
  newEngagement,
  newHash,
  paintJob,
  rate,
  storedJob,
  workerCard,
} from "./record-helpers.js";

async function exportOf(as: Person, query = ""): Promise<MyJobRecords> {
  const res = await call(as, HttpMethod.get, `/jobs/records/mine${query}`);
  expect(res.status).toBe(200);
  return res.json();
}

const deleteMine = (as: Person) => call(as, HttpMethod.delete, "/me/records");

describe("my work record: the export", () => {
  it("gives each side its own jobs with role, work, terms, stars and payments, and nobody else's", async () => {
    const w = await consented("+919888340001");
    const home = await consented("+919888340002");
    const stranger = await consented("+919888340003");
    const engagement = await storedJob(w, home, 700000);
    await rate(home, engagement, 5);
    const p = { payment: `pay_${ulid()}`, amount_paise: 700000, paid_on: "2026-11-03", method: "cash" };
    await call(w, HttpMethod.post, `/jobs/records/${engagement}/payments`, p);

    const [job] = (await exportOf(w)).jobs;
    expect(job).toMatchObject({
      engagement,
      role: Role.enum.provider,
      counterpart: home.session.user,
      work: { trade: "painter", scope: { rooms: "bhk2", labour_only: "yes" } },
      terms: { when: { day: "2026-11-02", window: "morning" }, coats: 2 },
      price_paise: 700000,
      status: "agreed",
      attested: true,
      stars: 5,
      payments: [{ ...p, confirmed: true }],
    });
    expect((await exportOf(home)).jobs[0]).toMatchObject({ role: Role.enum.requester, counterpart: w.session.user });
    expect((await exportOf(stranger)).jobs).toEqual([]);
    // A household's submission alone is not a job.
    await asHousehold(stranger, w, paintJob(newEngagement(), newHash()));
    expect((await exportOf(w)).jobs).toHaveLength(1);
    expect((await exportOf(stranger)).jobs).toEqual([]);
  });

  it("pages oldest first with a cursor, and refuses a bad page or no session", async () => {
    const w = await consented("+919888340004");
    const home = await consented("+919888340005");
    const made = [await storedJob(w, home), await storedJob(w, home), await storedJob(w, home)];
    const first = await exportOf(w, "?limit=2");
    expect(first.jobs.map((j) => j.engagement)).toEqual(made.slice(0, 2));
    expect(first.next).toBe(made[1]);
    const rest = await exportOf(w, `?limit=2&after=${first.next}`);
    expect(rest.jobs.map((j) => j.engagement)).toEqual([made[2]]);
    expect(rest).not.toHaveProperty("next");
    expect((await call(w, HttpMethod.get, "/jobs/records/mine?limit=0")).status).toBe(400);
    expect((await call(undefined, HttpMethod.get, "/jobs/records/mine")).status).toBe(401);
  });
});

describe("deleting my records", () => {
  it("keeps a household's jobs on the worker's record without its id, and withdraws its consent", async () => {
    const w = await consented("+919888340006");
    const home = await consented("+919888340007");
    await w.api.publishProfile(workerCard("Thimmakka"));
    await rate(home, await doneJob(w, home), 4);
    await doneJob(w, home);
    const res = await deleteMine(home);
    expect(await res.json()).toEqual({ deleted: 0, anonymised: 2, submissions: 4 });
    expect((await exportOf(home)).jobs).toEqual([]);
    const kept = (await exportOf(w)).jobs;
    expect(kept.map((j) => j.counterpart)).toEqual([null, null]);
    expect(kept[0]?.stars).toBe(4);
    // Still two jobs done, and the rating stays with them.
    expect((await cardOf(w, w.session.user)).record).toEqual({ jobs: 2, rated: 1, average: 4 });
    expect((await asWorker(home, w, paintJob(newEngagement(), newHash()))).status).toBe(403);
    expect((await call(home, HttpMethod.get, "/consent")).status).toBe(404);
  });

  it("deletes a worker's jobs and payments, so the household's export loses them too", async () => {
    const w = await consented("+919888340008");
    const home = await consented("+919888340009");
    const engagement = await storedJob(w, home);
    const p = { payment: `pay_${ulid()}`, amount_paise: 1000, paid_on: "2026-11-03", method: "upi" };
    await call(home, HttpMethod.post, `/jobs/records/${engagement}/payments`, p);
    expect(await (await deleteMine(w)).json()).toEqual({ deleted: 1, anonymised: 0, submissions: 2 });
    expect((await exportOf(w)).jobs).toEqual([]);
    expect((await exportOf(home)).jobs).toEqual([]);
    expect((await call(undefined, HttpMethod.delete, "/me/records")).status).toBe(401);
  });
});

describe("earnings analytics", () => {
  it("is admin only, and aggregates jobs and revenue the worker confirmed, per worker per month", async () => {
    const w = await consented("+919888340010");
    const home = await consented("+919888340011");
    const engagement = await storedJob(w, home, 500000);
    await storedJob(w, home, 300000);
    const paid = { payment: `pay_${ulid()}`, amount_paise: 500000, paid_on: "2026-11-05", method: "upi" };
    await call(w, HttpMethod.post, `/jobs/records/${engagement}/payments`, paid);
    const pending = { ...paid, payment: `pay_${ulid()}`, amount_paise: 1000 };
    await call(home, HttpMethod.post, `/jobs/records/${engagement}/payments`, pending);
    const path = "/admin/analytics/earnings?from=2026-11&to=2026-11";
    expect((await call(w, HttpMethod.get, path)).status).toBe(403);
    const res = await call(w, HttpMethod.get, path, undefined, { [ADMIN_HEADER]: ADMIN_KEY });
    const { rows } = (await res.json()) as { rows: { worker: string }[] };
    expect(rows.filter((r) => r.worker === w.session.user)).toEqual([
      { worker: w.session.user, month: "2026-11", jobs: 2, one_sided: 0, revenue_paise: 500000 },
    ]);
    const wide = "/admin/analytics/earnings?from=2020-01&to=2026-11";
    expect((await call(w, HttpMethod.get, wide, undefined, { [ADMIN_HEADER]: ADMIN_KEY })).status).toBe(400);
  });
});

describe("the records notice", () => {
  it("is shown as accepted after accepting it", async () => {
    const p = await signIn("+919888340012");
    await call(p, HttpMethod.put, "/consent", { notice_version: RECORDS_NOTICE_VERSION });
    const res = await call(p, HttpMethod.get, "/consent");
    expect(await res.json()).toMatchObject({ notice_version: RECORDS_NOTICE_VERSION, current: true });
    expect((await call(p, HttpMethod.put, "/consent", { notice_version: "" })).status).toBe(400);
    expect((await call(undefined, HttpMethod.put, "/consent", {})).status).toBe(401);
  });
});
