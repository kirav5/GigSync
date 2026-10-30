import { HttpMethod } from "@gigsync/core";
import { MAX_RESULTS, type WorkerRecord } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { worker } from "./qr-helpers.js";
import { cardOf, HUBBALLI, listed, recordCard, review, signedJob } from "./record-helpers.js";
import { sql } from "./sql.js";

const RECORD_COLUMNS_SQL = `SELECT record_jobs, record_rated, record_average_tenths, record_came_back
  FROM worker_profiles WHERE user_id = $1`;

describe("serving a worker's record on their card", () => {
  it("caps a number published higher than counted, and leaves one published lower as it is", async () => {
    const w = await listed("+919877710001", "Hanumanth", { jobs: 9, rated: 0, came_back: 0 });
    const home = await signIn("+919877710002");
    await signedJob(w, home);
    await signedJob(w, home);
    await signedJob(w, home);
    expect((await cardOf(home, w.session.user)).record).toEqual({ jobs: 3, rated: 0, came_back: 0 });
    await w.api.publishProfile(recordCard("Hanumanth", { jobs: 2, rated: 0, came_back: 0 }));
    expect((await cardOf(home, w.session.user)).record).toEqual({ jobs: 2, rated: 0, came_back: 0 });
  });

  it("shows the average only once three households rated, over the capped count", async () => {
    const w = await listed("+919877710003", "Iravva", { jobs: 30, rated: 25, average: 4.7, came_back: 0 });
    const viewer = await signIn("+919877710004");
    for (const phone of ["+919877710005", "+919877710006"]) {
      const home = await signIn(phone);
      await review(home, w, await signedJob(w, home));
    }
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 2, rated: 2, came_back: 0 });
    const third = await signIn("+919877710007");
    await review(third, w, await signedJob(w, third));
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 3, rated: 3, average: 4.7, came_back: 0 });
  });

  it("hides the whole record when the worker turns it off, and keeps none of its numbers", async () => {
    const w = await signIn("+919877710008");
    const home = await signIn("+919877710009");
    await signedJob(w, home);
    const published = await w.api.publishProfile({
      ...recordCard("Jayamma", { jobs: 1, rated: 0, came_back: 0 }),
      show_record: false,
    });
    expect(published).not.toHaveProperty("record");
    expect(published).not.toHaveProperty("show_record");
    expect(await cardOf(home, w.session.user)).not.toHaveProperty("record");
    const found = await home.api.searchWorkers({ trade: "painter", ...HUBBALLI, limit: MAX_RESULTS });
    const mine = found.find((f) => f.user === w.session.user);
    expect(mine).toBeDefined();
    expect(mine).not.toHaveProperty("record");
    expect(await sql(RECORD_COLUMNS_SQL, [w.session.user])).toEqual([
      { record_jobs: null, record_rated: null, record_average_tenths: null, record_came_back: null },
    ]);
  });

  it("serves the capped record on the publish answer and the scanned QR card, never the switch", async () => {
    const w = await signIn("+919877710010");
    const home = await signIn("+919877710011");
    await signedJob(w, home);
    const claim = { jobs: 4, rated: 0, came_back: 0 };
    const published = await w.api.publishProfile({ ...recordCard("Kalappa", claim), show_record: true });
    expect(published).toMatchObject({ record: { jobs: 1, rated: 0, came_back: 0 } });
    expect(published).not.toHaveProperty("show_record");
    const { code } = await w.api.myQr(worker("Kalappa"));
    expect(await home.api.lookupQr(code)).toMatchObject({ card: { record: { jobs: 1 } } });
  });

  it("never reorders or filters the board by record", async () => {
    // Nearest first, before and after: the worker with the best record is the farthest and stays last.
    const carpenter = (name: string, km: number, record?: WorkerRecord) => ({
      ...recordCard(name, record, km),
      trades: ["carpenter" as const],
    });
    const near = await signIn("+919877710012");
    const mid = await signIn("+919877710013");
    const far = await signIn("+919877710014");
    const home = await signIn("+919877710015");
    await near.api.publishProfile(carpenter("Lakshmana", 1));
    await mid.api.publishProfile(carpenter("Mallamma", 2));
    await far.api.publishProfile(carpenter("Nagappa", 3));
    const query = { trade: "carpenter" as const, ...HUBBALLI, radius_km: 4 };
    const before = (await home.api.searchWorkers(query)).map((w) => w.user);
    expect(before).toEqual([near.session.user, mid.session.user, far.session.user]);

    await mid.api.publishProfile(carpenter("Mallamma", 2, { jobs: 5, rated: 0, came_back: 0 }));
    await far.api.publishProfile(carpenter("Nagappa", 3, { jobs: 5, rated: 5, average: 5, came_back: 2 }));
    await review(home, far, await signedJob(far, home));
    await signedJob(far, home);
    await signedJob(mid, home);
    const after = await home.api.searchWorkers(query);
    expect(after.map((w) => w.user)).toEqual(before);
    expect(after.map((w) => w.record)).toEqual([
      undefined,
      { jobs: 1, rated: 0, came_back: 0 },
      { jobs: 2, rated: 1, came_back: 1 },
    ]);
  });

  it("refuses a bad user id, finds no card for an unlisted worker, and needs a session", async () => {
    const p = await signIn("+919877710016");
    expect((await call(p, HttpMethod.get, "/board/workers/nobody")).status).toBe(400);
    expect((await call(p, HttpMethod.get, `/board/workers/${p.session.user}`)).status).toBe(404);
    expect((await call(undefined, HttpMethod.get, `/board/workers/${p.session.user}`)).status).toBe(401);
  });
});
