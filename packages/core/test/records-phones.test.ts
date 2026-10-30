import type { EngagementId, JobRecordSubmit } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  agreeToRecords,
  type Clock,
  deleteMyRecords,
  MemoryStorage,
  noticeDue,
  RECORDS_RETRY_MS,
  recordsAgreed,
  SystemClock,
  settle,
} from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, type Phone, PRIYA, phone, RAVI, RAVI_PAYEE } from "./phones.js";
import { FakeRecords, noConsent, refused, unavailable } from "./records-fakes.js";

/** A clock a test moves by hand. */
class MovableClock implements Clock {
  at = Date.now();
  now() {
    return new Date(this.at);
  }
}

/** Ravi the electrician and Priya's household, each phone with its own view of GigSync's record routes. */
async function pair(agree = true, clock: Clock = new SystemClock()) {
  const relay = new MemoryRelay();
  const ravisApi = new FakeRecords();
  const priyasApi = new FakeRecords();
  const worker = await phone(relay, RAVI, {
    worker: electrician(),
    autoConfirm: true,
    payee: RAVI_PAYEE,
    records: ravisApi,
    clock,
  });
  const household = await phone(relay, PRIYA, { autoConfirm: true, records: priyasApi });
  if (agree)
    await Promise.all([agreeToRecords(ravisApi, worker.storage), agreeToRecords(priyasApi, household.storage)]);
  const both = [household.device, worker.device];
  return { worker, household, ravisApi, priyasApi, both };
}

async function signedJob(household: Phone, worker: Phone, both: Phone["device"][]) {
  const [job] = await household.device.request(fanNeed(65000, { problem: "fan dead, call 9800000101" }), [worker.user]);
  await settle(both);
  return job?.engagement.id as EngagementId;
}

/** What both sides must agree on: everything but whose side it is and that side's signature. */
const facts = ({ sig: _s, role: _r, counterpart: _c, ...rest }: JobRecordSubmit) => rest;

describe("job records on GigSync", () => {
  it("are attested alike by both phones once both sign, then the work, the money and the stars follow", async () => {
    const { worker, household, ravisApi, priyasApi, both } = await pair();
    const id = await signedJob(household, worker, both);
    const [ravis] = ravisApi.taken;
    const [priyas] = priyasApi.taken;
    if (ravis?.kind !== "job" || priyas?.kind !== "job") throw new Error("no attestation");
    expect(facts(ravis.body)).toEqual(facts(priyas.body));
    expect(ravis.body.sig).not.toBe(priyas.body.sig);
    expect(ravis.body.work).toEqual({ trade: "electrician", scope: { problem: "other" } });
    expect([ravis.body.role, priyas.body.counterpart]).toEqual(["provider", worker.user]);

    await worker.device.deliver(id, "Capacitor replaced");
    const asked = await worker.device.requestPayment(id, "Fan repair");
    await settle(both);
    await household.device.markPaid(asked.id, "412345678901");
    await settle(both);
    await worker.device.confirmPayment(asked.id);
    await settle(both);
    await household.device.review(id, { stars: 5, text: "Quick and tidy" });
    await settle(both);

    expect(ravisApi.kinds()).toEqual(["job", "status", "payment"]);
    expect(priyasApi.kinds()).toEqual(["job", "status", "stars"]);
    expect(priyasApi.taken.at(-1)).toEqual({ kind: "stars", engagement: id, body: { stars: 5 } });
    const everything = JSON.stringify([ravisApi.taken, priyasApi.taken]);
    for (const secret of ["9800000101", "Quick and tidy", "412345678901", "ravi.test@okaxis", "Flat 302", "Capacitor"])
      expect(everything).not.toContain(secret);
  });

  it("send nothing before the owner agreed to the notice, and all of it after", async () => {
    const { worker, household, ravisApi, both } = await pair(false);
    await signedJob(household, worker, both);
    expect(ravisApi.taken).toEqual([]);
    await agreeToRecords(ravisApi, worker.storage);
    await worker.device.sync();
    expect(ravisApi.kinds()).toEqual(["job"]);
  });

  it("stay pending while GigSync cannot take them, and go on a sync after a wait", async () => {
    const clock = new MovableClock();
    const { worker, household, ravisApi, both } = await pair(true, clock);
    ravisApi.failing = unavailable();
    await signedJob(household, worker, both);
    expect(ravisApi.taken).toEqual([]);
    ravisApi.failing = undefined;
    await worker.device.sync();
    expect(ravisApi.taken).toEqual([]);
    clock.at += RECORDS_RETRY_MS;
    await worker.device.sync();
    await worker.device.sync();
    expect(ravisApi.kinds()).toEqual(["job"]);
  });

  it("are not sent again once GigSync refused them for good, nor what would follow the job", async () => {
    const { worker, household, ravisApi, both } = await pair();
    ravisApi.failing = refused();
    const id = await signedJob(household, worker, both);
    ravisApi.failing = undefined;
    await worker.device.deliver(id, "Done");
    await worker.device.records?.run(true);
    expect(ravisApi.taken).toEqual([]);
  });

  it("ask the owner again when GigSync no longer holds their agreement, and keep the facts pending", async () => {
    const { worker, household, ravisApi, both } = await pair();
    ravisApi.failing = noConsent();
    await signedJob(household, worker, both);
    expect(await recordsAgreed(worker.storage)).toBe(false);
    ravisApi.failing = undefined;
    expect(await noticeDue(ravisApi, worker.storage)).toBe(false);
    await worker.device.records?.run(true);
    expect(ravisApi.kinds()).toEqual(["job"]);
  });

  it("are deleted on request, and the phone stops sending until the owner agrees again", async () => {
    const { worker, household, ravisApi, both } = await pair();
    const id = await signedJob(household, worker, both);
    await deleteMyRecords(ravisApi, worker.storage);
    expect(ravisApi.deleted).toBe(1);
    expect(await recordsAgreed(worker.storage)).toBe(false);
    expect(await noticeDue(ravisApi, worker.storage)).toBe(false);
    await worker.device.deliver(id, "Done");
    await settle(both);
    expect(ravisApi.kinds()).toEqual(["job"]);
    await agreeToRecords(ravisApi, worker.storage);
    await worker.device.sync();
    expect(ravisApi.kinds()).toEqual(["job", "job", "status"]);
  });
});

describe("the notice about job records", () => {
  it("is due until the owner agrees, here or on another phone", async () => {
    const api = new FakeRecords();
    const storage = new MemoryStorage();
    expect(await noticeDue(api, storage)).toBe(true);
    await api.acceptConsent();
    expect(await noticeDue(api, storage)).toBe(false);
    expect(await recordsAgreed(storage)).toBe(true);
  });

  it("is shown when GigSync cannot be reached and this phone has no answer", async () => {
    const api = new FakeRecords();
    api.failing = unavailable();
    expect(await noticeDue(api, new MemoryStorage())).toBe(true);
    await expect(agreeToRecords(api, new MemoryStorage())).rejects.toThrow();
  });
});
