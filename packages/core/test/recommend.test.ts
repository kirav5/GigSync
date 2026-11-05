import { type EngagementId, PART_PAYMENTS_PROTOCOL, RECOMMEND_PROTOCOL, type UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Collection, canRecommend, QrProblem, recommendedJobs, settle } from "../src/index.js";
import { cook, cookNeed, electrician, fanNeed, MemoryRelay, type Phone, PRIYA, phone, RAVI } from "./phones.js";
import { FakeQrServer, qrApiFor } from "./qr-phones.js";

const COOK = cookNeed(1_000_000, { people: "3", meals: "2", pets: "no" });

/** Ravi, and Priya's household with the fake QR routes; `workerProtocol` is what Ravi's phone understands. */
async function pair(workerProtocol = RECOMMEND_PROTOCOL, rules = electrician()) {
  const relay = new MemoryRelay();
  const server = new FakeQrServer();
  const { api, bind } = qrApiFor(server);
  const worker = await phone(relay, RAVI, { worker: rules, autoConfirm: true, protocol: workerProtocol });
  const household = await phone(relay, PRIYA, { autoConfirm: true, protocol: RECOMMEND_PROTOCOL, qrApi: api });
  bind(household.user);
  return { server, worker, household, both: [household.device, worker.device] };
}

async function signedFan(household: Phone, worker: Phone, both: Phone["device"][]): Promise<EngagementId> {
  const [job] = await household.device.request(fanNeed(65000, { problem: "fan dead" }), [worker.user]);
  await settle(both);
  return job?.engagement.id as EngagementId;
}

/** A fan repair done and signed, whose worker has a card and a live code on the server. */
async function doneFan() {
  const p = await pair();
  const id = await signedFan(p.household, p.worker, p.both);
  await p.worker.device.deliver(id, "Done");
  await settle(p.both);
  const code = p.server.listWorker(p.worker.user, p.household.user);
  return { ...p, id, code };
}

const blockOn = (p: Phone, user: UserId) =>
  p.storage.put(Collection.blocked, user, { user, at: new Date().toISOString() });

const refused = (work: Promise<unknown>, problem: QrProblem) => expect(work).rejects.toMatchObject({ problem });

describe("who a household may recommend", () => {
  it("is the worker on finished work both signed, on the household's side only", async () => {
    const { worker, household, both } = await pair();
    const id = await signedFan(household, worker, both);
    expect(canRecommend(await household.device.job(id))).toBe(false);
    await worker.device.deliver(id, "Done");
    await settle(both);
    expect(canRecommend(await household.device.job(id))).toBe(true);
    expect(canRecommend(await worker.device.job(id))).toBe(false);
  });

  it("includes recurring work under way, the worker a household knows best", async () => {
    const { worker, household, both } = await pair(RECOMMEND_PROTOCOL, cook());
    const [job] = await household.device.request(COOK, [worker.user]);
    await settle(both);
    expect(canRecommend(await household.device.job(job?.engagement.id as EngagementId))).toBe(true);
  });

  it("leaves out a cancelled job, even recurring work that went on for months", async () => {
    const { worker, household, both } = await pair(RECOMMEND_PROTOCOL, cook());
    const [job] = await household.device.request(COOK, [worker.user]);
    await settle(both);
    const id = job?.engagement.id as EngagementId;
    await household.device.cancelJob(id);
    await settle(both);
    expect(canRecommend(await household.device.job(id))).toBe(false);
  });
});

describe("the worker's link", () => {
  it("comes from the server for the household that hired them", async () => {
    const { household, id, code } = await doneFan();
    expect(await household.device.recommendations.code(id)).toBe(code);
  });

  it("is refused by this phone before the work is done, without asking the server", async () => {
    const { server, worker, household, both } = await pair();
    const id = await signedFan(household, worker, both);
    await refused(household.device.recommendations.code(id), QrProblem.no_job_record);
    expect(server.recommended).toBe(0);
  });

  it("says why the server refused", async () => {
    const { server, worker, household, id } = await doneFan();
    server.unlist(worker.user);
    await refused(household.device.recommendations.code(id), QrProblem.not_listed);
    server.forgetJob(worker.user, household.user);
    await refused(household.device.recommendations.code(id), QrProblem.no_job_record);
  });

  it("is refused for someone this household blocked", async () => {
    const { worker, household, id } = await doneFan();
    await blockOn(household, worker.user);
    await refused(household.device.recommendations.code(id), QrProblem.blocked);
  });

  it("needs the server's routes", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true });
    const household = await phone(relay, PRIYA, { autoConfirm: true });
    const id = await signedFan(household, worker, [household.device, worker.device]);
    await refused(household.device.recommendations.code(id), QrProblem.no_server);
  });
});

describe("telling the worker", () => {
  it("shows on their phone until they read it, and only on theirs", async () => {
    const { worker, household, both, id } = await doneFan();
    expect(await household.device.recommendations.tell(id)).toBe(true);
    await settle(both);
    expect(recommendedJobs(await worker.device.jobs()).map((j) => j.engagement.id)).toEqual([id]);
    expect(recommendedJobs(await household.device.jobs())).toEqual([]);
    await worker.device.recommendations.read(id);
    expect(recommendedJobs(await worker.device.jobs())).toEqual([]);
  });

  it("happens once per job, however often the household shares", async () => {
    const { worker, household, both, id } = await doneFan();
    await household.device.recommendations.tell(id);
    await settle(both);
    await worker.device.recommendations.read(id);
    expect(await household.device.recommendations.tell(id)).toBe(true);
    await settle(both);
    expect(recommendedJobs(await worker.device.jobs())).toEqual([]);
  });

  it("leaves the job as it was", async () => {
    const { worker, household, both, id } = await doneFan();
    const before = (await worker.device.job(id)).engagement.status;
    await household.device.recommendations.tell(id);
    await settle(both);
    expect((await worker.device.job(id)).engagement.status).toBe(before);
  });

  it("sends nothing to a phone too old to read it, and says so", async () => {
    const { worker, household, both } = await pair(PART_PAYMENTS_PROTOCOL);
    const id = await signedFan(household, worker, both);
    await worker.device.deliver(id, "Done");
    await settle(both);
    expect(await household.device.recommendations.tell(id)).toBe(false);
    await settle(both);
    expect(recommendedJobs(await worker.device.jobs())).toEqual([]);
  });

  it("drops the news on a phone that blocked the household", async () => {
    const { worker, household, both, id } = await doneFan();
    await blockOn(worker, household.user);
    await household.device.recommendations.tell(id);
    await settle(both);
    expect(recommendedJobs(await worker.device.jobs())).toEqual([]);
  });
});
