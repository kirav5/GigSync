import { HttpMethod } from "@gigsync/core";
import { type EngagementId, RecordRefusal, STARS_PER_HOUR } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import type { Person } from "./people.js";
import { consented, rate, storedJob } from "./record-helpers.js";
import { sql } from "./sql.js";

const R = RecordRefusal.enum;
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;
const payment = (amount = 900000) => ({
  payment: `pay_${ulid()}`,
  amount_paise: amount,
  paid_on: "2026-11-02",
  method: "upi",
});
const pay = (as: Person, engagement: EngagementId, body: unknown) =>
  call(as, HttpMethod.post, `/jobs/records/${engagement}/payments`, body);
const confirm = (as: Person, engagement: EngagementId, id: string) =>
  call(as, HttpMethod.post, `/jobs/records/${engagement}/payments/${id}/confirm`);
const stars = (as: Person, engagement: EngagementId, n: number) =>
  call(as, HttpMethod.put, `/jobs/records/${engagement}/stars`, { stars: n });

async function threePeople(n: number): Promise<[Person, Person, Person]> {
  const base = 919888320000 + n * 3;
  return Promise.all([consented(`+${base}`), consented(`+${base + 1}`), consented(`+${base + 2}`)]);
}

describe("payments on a stored job", () => {
  it("counts the worker's report of receipt at once, and a household's once the worker confirms it", async () => {
    const [w, home] = await threePeople(1);
    const engagement = await storedJob(w, home);
    const received = payment();
    const res = await pay(w, engagement, received);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...received, confirmed: true });
    const paid = payment(100000);
    expect(await (await pay(home, engagement, paid)).json()).toMatchObject({ confirmed: false });
    const refused = await confirm(home, engagement, paid.payment);
    expect(refused.status).toBe(403);
    expect(await errorOf(refused)).toBe(R.workers_only);
    expect(await (await confirm(w, engagement, paid.payment)).json()).toMatchObject({ confirmed: true });
    expect(await (await confirm(w, engagement, paid.payment)).json()).toMatchObject({ confirmed: true });
  });

  it("answers a retry as before, refuses an id reused for another payment, and never takes a UPI reference", async () => {
    const [w, home] = await threePeople(2);
    const engagement = await storedJob(w, home);
    const p = payment();
    expect((await pay(home, engagement, p)).status).toBe(201);
    expect((await pay(home, engagement, p)).status).toBe(201);
    const reused = await pay(home, engagement, { ...p, amount_paise: 1 });
    expect(reused.status).toBe(409);
    expect(await errorOf(reused)).toBe(R.record_differs);
    expect((await pay(home, engagement, { ...payment(), utr: "123456789012" })).status).toBe(400);
    expect((await pay(home, engagement, { ...payment(), method: "cheque" })).status).toBe(400);
  });

  it("refuses a stranger, an unstored job, a payment of another job and a cancelled job", async () => {
    const [w, home, stranger] = await threePeople(3);
    const engagement = await storedJob(w, home);
    expect((await pay(stranger, engagement, payment())).status).toBe(404);
    expect((await pay(home, `eng_${ulid()}`, payment())).status).toBe(404);
    const other = await storedJob(w, home);
    const p = payment();
    await pay(home, other, p);
    expect((await confirm(w, engagement, p.payment)).status).toBe(404);
    expect((await confirm(stranger, other, p.payment)).status).toBe(404);
    await call(home, HttpMethod.post, `/jobs/records/${engagement}/status`, { status: "cancelled" });
    const late = await pay(home, engagement, payment());
    expect(late.status).toBe(409);
    expect(await errorOf(late)).toBe(R.wrong_status);
  });
});

describe("stars on a stored job", () => {
  it("come from the household only, and a later one replaces the last", async () => {
    const [w, home, stranger] = await threePeople(4);
    const engagement = await storedJob(w, home);
    await rate(home, engagement, 3);
    await rate(home, engagement, 5);
    const rows = await sql("SELECT stars FROM job_records WHERE engagement_id = $1", [engagement]);
    expect(rows).toEqual([{ stars: 5 }]);
    const self = await stars(w, engagement, 5);
    expect(self.status).toBe(403);
    expect(await errorOf(self)).toBe(R.households_only);
    expect((await stars(stranger, engagement, 5)).status).toBe(404);
    expect((await stars(home, engagement, 0)).status).toBe(400);
  });

  it("refuse a cancelled job, need the notice, and cap replacements per hour", async () => {
    const [w, home] = await threePeople(5);
    const engagement = await storedJob(w, home);
    for (let i = 1; i < STARS_PER_HOUR; i++) await rate(home, engagement, 4);
    expect((await stars(home, engagement, 4)).status).toBe(204);
    expect((await stars(home, engagement, 4)).status).toBe(429);
    const cancelled = await storedJob(w, home);
    await call(w, HttpMethod.post, `/jobs/records/${cancelled}/status`, { status: "cancelled" });
    expect((await stars(home, cancelled, 4)).status).toBe(409);
    await sql("UPDATE consents SET withdrawn_at = now() WHERE user_id = $1", [home.session.user]);
    expect((await stars(home, engagement, 4)).status).toBe(403);
  });
});
