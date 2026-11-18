import { type EngagementId, PROBLEM_HOLD_DAYS, PROBLEM_PROTOCOL } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type Clock,
  ProblemBy,
  ProblemError,
  REMOVED_MARK,
  ReportBlock,
  SETTLE_CAP_DAYS,
  settle,
  whyNoReport,
} from "../src/index.js";
import {
  ASHA,
  cook,
  cookNeed,
  electrician,
  fanNeed,
  MemoryRelay,
  type Phone,
  PRIYA,
  phone,
  RAVI,
  RAVI_HOME,
  RAVI_PAYEE,
} from "./phones.js";

/** Both phones' clock, moved by hand. */
class MovableClock implements Clock {
  at = Date.now();
  now() {
    return new Date(this.at);
  }
  days(n: number) {
    this.at += n * 86_400_000;
  }
}

const ASHA_PAYEE = { vpa: "asha.cook@okhdfc", name: "Asha" };

/** Ravi the electrician and Priya's household on one clock; `protocol` says what both phones understand. */
async function pair(protocol?: number) {
  const relay = new MemoryRelay();
  const clock = new MovableClock();
  const at = { clock, ...(protocol ? { protocol } : {}) };
  const worker = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true, payee: RAVI_PAYEE, ...at });
  const household = await phone(relay, PRIYA, { autoConfirm: true, ...at });
  return { worker, household, clock, both: [household.device, worker.device] };
}

/** Priya's door, as the pin on her address puts it (ADR 0050 §7). */
const PRIYA_DOOR = { lat: 12.9719, lon: 77.6412 };

/** A fan repair both signed, with Priya's number and address typed into her words, sent to her door. */
async function signedFan(household: Phone, worker: Phone, both: Phone["device"][]): Promise<EngagementId> {
  const need = {
    ...fanNeed(65000, { problem: "fan dead, call 9800000101" }),
    need: "Fan at Flat 302, 3rd floor, 5th Cross",
    site: "Flat 302, 3rd floor, 5th Cross",
    door: PRIYA_DOOR,
  };
  const [job] = await household.device.request(need, [worker.user]);
  await settle(both);
  return job?.engagement.id as EngagementId;
}

/** The worker asks, the household pays, the worker confirms. */
async function paid(household: Phone, worker: Phone, both: Phone["device"][], id: EngagementId) {
  const asked = await worker.device.requestPayment(id, "Payment");
  await settle(both);
  await household.device.markPaid(asked.id);
  await settle(both);
  await worker.device.confirmPayment(asked.id);
  await settle(both);
}

const job = (p: Phone, id: EngagementId) => p.device.job(id);

describe("contact details of a one-time job", () => {
  it("go from both phones once it is done and the worker confirmed payment; the record stays", async () => {
    const { worker, household, both } = await pair();
    const id = await signedFan(household, worker, both);
    expect((await job(worker, id)).contact).toMatchObject({ phone: PRIYA.phone, point: PRIYA_DOOR });
    await worker.device.deliver(id, "Done, call 98450 12345 if it stops");
    await settle(both);
    expect((await job(household, id)).contact).toBeDefined();
    await paid(household, worker, both, id);

    for (const p of [worker, household]) {
      const r = await job(p, id);
      expect(r.contact).toBeUndefined();
      expect(r.contacts_removed_at).toBeDefined();
      const words = JSON.stringify([r.request, r.engagement.brief, r.notes]);
      for (const gone of ["9800000101", "98450 12345", "Flat 302, 3rd floor, 5th Cross"])
        expect(words).not.toContain(gone);
      expect(words).toContain(REMOVED_MARK);
      expect(r.mine?.terms.price_paise).toBeGreaterThan(0);
    }
    // Whom the job was with is still known: by name on the job, and for an introduction.
    expect((await job(worker, id)).their_name).toBe(PRIYA.name);
    expect((await worker.device.mentors.people()).map((p) => p.card.name)).toEqual([PRIYA.name]);
    const need = await household.device.store.need((await job(household, id)).engagement.group);
    expect(JSON.stringify(need)).not.toContain("9800000101");
    expect(need?.door).toBeUndefined();
    expect(await household.device.payments.forEngagement(id)).toHaveLength(1);

    // Words that reach the job later (a note that was on its way) are cleaned on the next sync too.
    const later = await job(household, id);
    await household.device.store.saveJob({
      ...later,
      notes: [...(later.notes ?? []), { text: "or 9876543210", lang: "en" }],
    });
    await household.device.sync();
    expect((await job(household, id)).notes?.at(-1)?.text).toBe(`or ${REMOVED_MARK}`);
  });

  it("stay while unpaid, and go three days after it was done", async () => {
    const { worker, household, clock, both } = await pair();
    const id = await signedFan(household, worker, both);
    await worker.device.deliver(id, "Done");
    await settle(both);
    clock.days(SETTLE_CAP_DAYS - 1);
    await settle(both);
    expect((await job(worker, id)).contact).toBeDefined();
    clock.days(1);
    await settle(both);
    for (const p of [worker, household]) expect((await job(p, id)).contact).toBeUndefined();
  });

  it("stay while the job is still ahead, however long", async () => {
    const { worker, household, clock, both } = await pair();
    const id = await signedFan(household, worker, both);
    clock.days(SETTLE_CAP_DAYS * 10);
    await settle(both);
    expect((await job(household, id)).contact?.name).toBe(RAVI.name);
  });
});

describe("contact details of a monthly arrangement", () => {
  async function cookPair() {
    const relay = new MemoryRelay();
    const clock = new MovableClock();
    const worker = await phone(relay, ASHA, { worker: cook(), autoConfirm: true, payee: ASHA_PAYEE, clock });
    const household = await phone(relay, RAVI_HOME, { autoConfirm: true, clock });
    const both = [household.device, worker.device];
    const need = cookNeed(1_000_000, { people: "3", meals: "2", pets: "no" });
    const [request] = await household.device.request(need, [worker.user]);
    await settle(both);
    return { worker, household, clock, both, id: request?.engagement.id as EngagementId };
  }

  it("stay while it goes on, month after paid month", async () => {
    const { worker, household, clock, both, id } = await cookPair();
    await paid(household, worker, both, id);
    clock.days(40);
    await settle(both);
    for (const p of [worker, household]) expect((await job(p, id)).contact).toBeDefined();
  });

  it("go once it ends and its last payment is confirmed", async () => {
    const { worker, household, clock, both, id } = await cookPair();
    await paid(household, worker, both, id);
    clock.days(1);
    await worker.device.deliver(id, "Last day today");
    await settle(both);
    expect((await job(household, id)).contact).toBeDefined();
    clock.days(1);
    await paid(household, worker, both, id);
    for (const p of [worker, household]) expect((await job(p, id)).contact).toBeUndefined();
  });

  it("are kept on a cancellation to settle up, and go three days after it", async () => {
    const { worker, household, clock, both, id } = await cookPair();
    await household.device.cancelJob(id);
    await settle(both);
    expect((await job(household, id)).contact?.name).toBe(ASHA.name);
    expect((await job(worker, id)).contact?.address).toBe(RAVI_HOME.address);
    clock.days(SETTLE_CAP_DAYS);
    await settle(both);
    for (const p of [worker, household]) expect((await job(p, id)).contact).toBeUndefined();
  });
});

describe("Report a problem", () => {
  it("keeps the contacts on both phones until either side marks it resolved", async () => {
    const { worker, household, clock, both } = await pair(PROBLEM_PROTOCOL);
    const id = await signedFan(household, worker, both);
    await worker.device.deliver(id, "Done");
    await settle(both);
    await household.device.contacts.report(id, { reason: "work_unfinished", text: "Fan still wobbles, 9800000101" });
    await settle(both);
    expect((await job(worker, id)).problem).toMatchObject({ by: ProblemBy.them, reason: "work_unfinished" });
    await paid(household, worker, both, id);
    clock.days(SETTLE_CAP_DAYS + 1);
    await settle(both);
    for (const p of [worker, household]) expect((await job(p, id)).contact).toBeDefined();

    await worker.device.contacts.resolve(id);
    await settle(both);
    for (const p of [worker, household]) {
      const r = await job(p, id);
      expect(r.problem?.resolved_at).toBeDefined();
      expect(r.contact).toBeUndefined();
      expect(r.problem?.text).toBe(`Fan still wobbles, ${REMOVED_MARK}`);
    }
    await expect(household.device.contacts.report(id, { reason: "other" })).rejects.toThrow(ProblemError);
  });

  it("holds them at most thirty days", async () => {
    const { worker, household, clock, both } = await pair(PROBLEM_PROTOCOL);
    const id = await signedFan(household, worker, both);
    await worker.device.deliver(id, "Done");
    await settle(both);
    await worker.device.contacts.report(id, { reason: "not_paid" });
    await settle(both);
    clock.days(PROBLEM_HOLD_DAYS - 1);
    await settle(both);
    expect((await job(household, id)).contact).toBeDefined();
    clock.days(1);
    await settle(both);
    for (const p of [worker, household]) expect((await job(p, id)).contact).toBeUndefined();
  });

  it("stays on this phone alone when the other phone is too old to be told", async () => {
    const { worker, household, both } = await pair();
    const id = await signedFan(household, worker, both);
    const r = await household.device.contacts.report(id, { reason: "damage" });
    await settle(both);
    expect(r.problem).toMatchObject({ by: ProblemBy.me, told: false });
    expect((await job(worker, id)).problem).toBeUndefined();
  });

  it("cannot be reported on a job not yet signed", async () => {
    const { worker, household } = await pair(PROBLEM_PROTOCOL);
    const [request] = await household.device.request(fanNeed(), [worker.user]);
    const id = request?.engagement.id as EngagementId;
    await expect(household.device.contacts.report(id, { reason: "other" })).rejects.toThrow(ProblemError);
  });
});

describe("why a job has no Report a problem", () => {
  it("says a request must be signed first, and a declined one never was", async () => {
    const { worker, household, both } = await pair(PROBLEM_PROTOCOL);
    const [request] = await household.device.request(fanNeed(), [worker.user]);
    const id = request?.engagement.id as EngagementId;
    await settle(both);
    expect(whyNoReport(await job(household, id))).toBe(ReportBlock.unsigned);
    await worker.device.declineRequest(id);
    await settle(both);
    expect(whyNoReport(await job(household, id))).toBe(ReportBlock.neverSigned);
  });

  it("says nothing while one can be reported, and says settled once the contacts go", async () => {
    const { worker, household, both } = await pair(PROBLEM_PROTOCOL);
    const id = await signedFan(household, worker, both);
    expect(whyNoReport(await job(household, id))).toBeUndefined();
    await worker.device.deliver(id, "Done");
    await settle(both);
    await paid(household, worker, both, id);
    expect(whyNoReport(await job(household, id))).toBe(ReportBlock.settled);
  });
});
