import { HttpMethod } from "@gigsync/core";
import { JobSubmitState, RECORDS_NOTICE_VERSION, RecordRefusal } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import {
  asHousehold,
  asWorker,
  consented,
  newEngagement,
  newHash,
  paintJob,
  stateOf,
  storedJob,
  submit,
} from "./record-helpers.js";
import { sql } from "./sql.js";

const S = JobSubmitState.enum;
const R = RecordRefusal.enum;
const ATTESTED_SQL = "SELECT attested FROM job_records WHERE engagement_id = $1";
/** [] when no job is stored for the engagement, else [whether both sides attested it]. */
const attested = async (engagement: string) =>
  (await sql<{ attested: boolean }>(ATTESTED_SQL, [engagement])).map((r) => r.attested);
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

describe("two-party attestation of a job record", () => {
  it("attests a job once both sides sent the same fields with valid signatures", async () => {
    const w = await consented("+919888310001");
    const home = await consented("+919888310002");
    const job = paintJob(newEngagement(), newHash());
    expect(await stateOf(await asWorker(w, home, job))).toBe(S.pending);
    expect(await attested(job.engagement)).toEqual([]);
    expect(await stateOf(await asHousehold(home, w, job))).toBe(S.stored);
    expect(await attested(job.engagement)).toEqual([true]);
    // A retry answers as before; different fields for a stored job are refused.
    expect(await stateOf(await asWorker(w, home, job))).toBe(S.stored);
    const changed = await asWorker(w, home, { ...job, price_paise: 1 });
    expect(changed.status).toBe(409);
    expect(await errorOf(changed)).toBe(R.record_differs);
  });

  it("sets a mismatch aside without counting it, and stores once a side corrects it", async () => {
    const w = await consented("+919888310003");
    const home = await consented("+919888310004");
    const job = paintJob(newEngagement(), newHash());
    expect(await stateOf(await asWorker(w, home, { ...job, price_paise: 950000 }))).toBe(S.pending);
    expect(await stateOf(await asHousehold(home, w, job))).toBe(S.mismatch);
    expect(await attested(job.engagement)).toEqual([]);
    expect(await stateOf(await asWorker(w, home, job))).toBe(S.stored);
    expect(await attested(job.engagement)).toEqual([true]);
  });

  it("refuses a signature that is not the sender's, and one by a revoked device", async () => {
    const w = await consented("+919888310005");
    const home = await consented("+919888310006");
    const job = paintJob(newEngagement(), newHash());
    const forged = await submit(w, home, "provider", job, home);
    expect(forged.status).toBe(400);
    expect(await errorOf(forged)).toBe(R.bad_signature);

    const newPhone = await signIn("+919888310005");
    expect((await call(newPhone, HttpMethod.delete, `/devices/${w.session.device}`)).status).toBe(204);
    expect((await submit(newPhone, home, "provider", job, w)).status).toBe(400);
    expect(await stateOf(await submit(newPhone, home, "provider", job))).toBe(S.pending);
  });

  it("refuses without the current notice, and refuses an older notice", async () => {
    const w = await signIn("+919888310007");
    const home = await consented("+919888310008");
    const job = paintJob(newEngagement(), newHash());
    const res = await asWorker(w, home, job);
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe(R.no_consent);
    expect((await call(w, HttpMethod.get, "/consent")).status).toBe(404);
    const old = await call(w, HttpMethod.put, "/consent", { notice_version: "2020-01-01" });
    expect(old.status).toBe(409);
    expect(await errorOf(old)).toBe(R.stale_notice);
    await sql("UPDATE consents SET notice_version = '2020-01-01' WHERE user_id = $1", [home.session.user]);
    expect((await asHousehold(home, w, job)).status).toBe(403);
    const now = await call(home, HttpMethod.put, "/consent", { notice_version: RECORDS_NOTICE_VERSION });
    expect(await now.json()).toMatchObject({ notice_version: RECORDS_NOTICE_VERSION, current: true });
  });

  it("refuses free text, yourself as counterpart, an unknown counterpart, and no session", async () => {
    const w = await consented("+919888310009");
    const home = await consented("+919888310010");
    const job = paintJob(newEngagement(), newHash());
    const words = { ...job, work: { ...job.work, scope: { ...job.work.scope, note: "2nd cross, call me" } } };
    expect((await asWorker(w, home, words)).status).toBe(400);
    expect((await asWorker(w, w, job)).status).toBe(400);
    const ghost = { ...home, session: { ...home.session, user: "usr_01J0000000000000000000ZZZZ" as const } };
    expect((await asWorker(w, ghost, job)).status).toBe(404);
    expect((await call(undefined, HttpMethod.post, "/jobs/records", {})).status).toBe(401);
  });
});

describe("a stored job's status", () => {
  it("moves to done by either side, once, and refuses strangers and later changes", async () => {
    const w = await consented("+919888310011");
    const home = await consented("+919888310012");
    const stranger = await consented("+919888310013");
    const engagement = await storedJob(w, home);
    const path = `/jobs/records/${engagement}/status`;
    expect((await call(stranger, HttpMethod.post, path, { status: "done" })).status).toBe(404);
    expect((await call(home, HttpMethod.post, path, { status: "done" })).status).toBe(200);
    expect((await call(w, HttpMethod.post, path, { status: "done" })).status).toBe(200);
    const late = await call(w, HttpMethod.post, path, { status: "cancelled" });
    expect(late.status).toBe(409);
    expect(await errorOf(late)).toBe(R.wrong_status);
    expect((await call(w, HttpMethod.post, path, { status: "agreed" })).status).toBe(400);
    expect((await call(w, HttpMethod.post, "/jobs/records/eng-1/status", { status: "done" })).status).toBe(400);
  });
});
