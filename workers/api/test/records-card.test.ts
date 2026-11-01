import { HttpMethod } from "@gigsync/core";
import type { MyBoardProfile } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";
import { worker } from "./qr-helpers.js";
import { cardOf, consented, doneJob, MYSURU, rate, storedJob, workerCard } from "./record-helpers.js";

/** A worker with a card on the board and the notice accepted. */
async function listedWorker(phone: string, name: string, km = 0): Promise<Person> {
  const w = await consented(phone);
  await w.api.publishProfile(workerCard(name, km));
  return w;
}

async function myCard(w: Person): Promise<MyBoardProfile> {
  const res = await call(w, HttpMethod.get, "/board/profile");
  expect(res.status).toBe(200);
  return res.json();
}

describe("a worker's record, computed from stored jobs", () => {
  it("counts jobs done only, never agreed or cancelled ones, has no came back, and ignores a published record", async () => {
    const w = await listedWorker("+919888330001", "Mahadeva");
    const home = await consented("+919888330002");
    const viewer = await signIn("+919888330003");
    expect(await cardOf(viewer, w.session.user)).not.toHaveProperty("record");
    // Agreed work still ahead is not done: no record yet.
    await storedJob(w, home);
    expect(await cardOf(viewer, w.session.user)).not.toHaveProperty("record");
    await doneJob(w, home);
    await doneJob(w, home);
    const dropped = await storedJob(w, home);
    await call(home, HttpMethod.post, `/jobs/records/${dropped}/status`, { status: "cancelled" });
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 2, rated: 0 });
    const claim = { jobs: 90, rated: 80, average: 5 };
    await w.api.publishProfile({ ...workerCard("Mahadeva"), record: claim });
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 2, rated: 0 });
  });

  it("shows the average from the first rating, to one decimal", async () => {
    const w = await listedWorker("+919888330004", "Nanjamma");
    const viewer = await signIn("+919888330005");
    const homes = await Promise.all(["+919888330006", "+919888330007", "+919888330008"].map(consented));
    const [first, second, third] = homes as [Person, Person, Person];
    await rate(first, await doneJob(w, first), 5);
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 1, rated: 1, average: 5 });
    await rate(second, await doneJob(w, second), 4);
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 2, rated: 2, average: 4.5 });
    await rate(third, await doneJob(w, third), 4);
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 3, rated: 3, average: 4.3 });
  });

  it("hides the whole record from others when the worker turns it off, and keeps showing it to her", async () => {
    const w = await listedWorker("+919888330009", "Puttaraju");
    const home = await consented("+919888330010");
    await doneJob(w, home);
    await w.api.publishProfile({ ...workerCard("Puttaraju"), show_record: false });
    expect(await cardOf(home, w.session.user)).not.toHaveProperty("record");
    const found = await home.api.searchWorkers({ trade: "painter", ...MYSURU });
    expect(found.find((f) => f.user === w.session.user)).not.toHaveProperty("record");
    const { code } = await w.api.myQr(worker("Puttaraju"));
    expect(await home.api.lookupQr(code)).not.toHaveProperty("card.record");
    expect(await myCard(w)).toMatchObject({ show_record: false, record: { jobs: 1 } });
    // Absent keeps the switch as it was; true shows it again.
    await w.api.publishProfile(workerCard("Puttaraju"));
    expect(await cardOf(home, w.session.user)).not.toHaveProperty("record");
    await w.api.publishProfile({ ...workerCard("Puttaraju"), show_record: true });
    expect((await cardOf(home, w.session.user)).record).toEqual({ jobs: 1, rated: 0 });
    expect(await myCard(w)).toMatchObject({ show_record: true });
  });

  it("never reorders or filters the board by record", async () => {
    const near = await listedWorker("+919888330011", "Ramu", 1);
    const far = await listedWorker("+919888330012", "Shivu", 3);
    const home = await consented("+919888330013");
    const query = { trade: "painter" as const, ...MYSURU, radius_km: 4 };
    const before = (await home.api.searchWorkers(query)).map((w) => w.user);
    expect(before.indexOf(near.session.user)).toBeLessThan(before.indexOf(far.session.user));
    await rate(home, await storedJob(far, home), 5);
    await storedJob(far, home);
    expect((await home.api.searchWorkers(query)).map((w) => w.user)).toEqual(before);
  });
});
