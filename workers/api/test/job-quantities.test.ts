import { HttpMethod } from "@gigsync/core";
import { type JobQuantities, JobSubmitState, type MyJobRecords } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { asHousehold, asWorker, consented, newEngagement, newHash, paintJob, stateOf } from "./record-helpers.js";
import { sql } from "./sql.js";

/** ADR 0041 §4: job records carry quantities, never words; the two sides are compared without them. */

const S = JobSubmitState.enum;
const VILLA: JobQuantities = { area_band: "2501_3500", surface: "both", floors: 2, house_type: "villa" };
const QTY_SQL =
  "SELECT qty_area_band, qty_surface, qty_floors, qty_house_type FROM job_records WHERE engagement_id = $1";
const quantities = async (engagement: string) => (await sql(QTY_SQL, [engagement]))[0];

describe("a job record's quantities", () => {
  it("are kept when both sides send the same ones", async () => {
    const w = await consented("+919888410001");
    const home = await consented("+919888410002");
    const job = { ...paintJob(newEngagement(), newHash()), quantities: VILLA };
    expect(await stateOf(await asWorker(w, home, job))).toBe(S.pending);
    expect(await stateOf(await asHousehold(home, w, job))).toBe(S.stored);
    expect(await quantities(job.engagement)).toEqual({
      qty_area_band: "2501_3500",
      qty_surface: "both",
      qty_floors: 2,
      qty_house_type: "villa",
    });
    const res = await call(w, HttpMethod.get, "/jobs/records/mine");
    const mine = (await res.json()) as MyJobRecords;
    expect(mine.jobs.find((j) => j.engagement === job.engagement)?.quantities).toEqual(VILLA);
  });

  it("from one side only (an older phone sends none) still attest, and the record keeps them", async () => {
    const w = await consented("+919888410003");
    const home = await consented("+919888410004");
    const base = paintJob(newEngagement(), newHash());
    expect(await stateOf(await asHousehold(home, w, base))).toBe(S.pending);
    expect(await stateOf(await asWorker(w, home, { ...base, quantities: VILLA }))).toBe(S.stored);
    expect(await quantities(base.engagement)).toMatchObject({ qty_surface: "both" });
  });

  it("that differ between the sides attest the job but keep none", async () => {
    const w = await consented("+919888410005");
    const home = await consented("+919888410006");
    const base = paintJob(newEngagement(), newHash());
    expect(await stateOf(await asWorker(w, home, { ...base, quantities: VILLA }))).toBe(S.pending);
    const other = { ...VILLA, floors: 3 };
    expect(await stateOf(await asHousehold(home, w, { ...base, quantities: other }))).toBe(S.stored);
    expect(await quantities(base.engagement)).toEqual({
      qty_area_band: null,
      qty_surface: null,
      qty_floors: null,
      qty_house_type: null,
    });
  });

  it("refuse a quantity the trade does not have, or words", async () => {
    const w = await consented("+919888410007");
    const home = await consented("+919888410008");
    const base = paintJob(newEngagement(), newHash());
    expect((await asWorker(w, home, { ...base, quantities: { people: 4 } })).status).toBe(400);
    const words = { ...base, quantities: { surface: "the big wall near the gate" } };
    expect((await asWorker(w, home, words as unknown as typeof base)).status).toBe(400);
  });
});
