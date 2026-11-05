import { type EngagementId, PART_PAYMENTS_PROTOCOL, type Payee, StopReason } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  AftercareError,
  advanceCap,
  balanceDue,
  canAskAdvance,
  jobProgress,
  nextWorkerStep,
  paidUp,
  Step,
  settle,
  workStarted,
} from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI, RAVI_PAYEE } from "./phones.js";

/** ADR 0054: the worker moves a job on in order, and money follows the work. */

async function agreedJob(
  protocols = { home: PART_PAYMENTS_PROTOCOL, work: PART_PAYMENTS_PROTOCOL },
  payee: Payee = RAVI_PAYEE,
) {
  const relay = new MemoryRelay();
  const worker = await phone(relay, RAVI, {
    worker: electrician(),
    autoConfirm: true,
    payee,
    protocol: protocols.work,
  });
  const consumer = await phone(relay, PRIYA, { autoConfirm: true, protocol: protocols.home });
  const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
  const id = job?.engagement.id as EngagementId;
  const both = [consumer.device, worker.device];
  await settle(both);
  const price = (await worker.device.job(id)).mine?.terms.price_paise as number;
  return { worker, consumer, id, price, both };
}

describe("the worker's steps", () => {
  it("come one at a time: on the way, started, done", async () => {
    const { worker, id } = await agreedJob();
    expect(nextWorkerStep(await worker.device.job(id))).toBe("on_my_way");
    await worker.device.update(id, { code: "on_my_way" });
    expect(nextWorkerStep(await worker.device.job(id))).toBe("started");
    expect(workStarted(await worker.device.job(id))).toBe(false);
    await worker.device.update(id, { code: "started" });
    expect(nextWorkerStep(await worker.device.job(id))).toBe("done");
    expect(workStarted(await worker.device.job(id))).toBe(true);
    await worker.device.deliver(id, { code: "done" });
    expect(nextWorkerStep(await worker.device.job(id))).toBeUndefined();
  });

  it("carry the reason a job was stopped after it started, to the other phone", async () => {
    const { worker, consumer, id, both } = await agreedJob();
    await worker.device.update(id, { code: "started" });
    await worker.device.cancelJob(id, StopReason.enum.not_safe);
    await settle(both);
    const hers = await consumer.device.job(id);
    expect(hers.engagement.status).toBe("cancelled");
    expect(hers.cancel?.stop).toBe(StopReason.enum.not_safe);
  });
});

describe("money follows the work", () => {
  it("refuses a one-off job's payment before the work is done, by UPI or in cash", async () => {
    const { worker, id } = await agreedJob();
    await expect(worker.device.requestPayment(id, "Fan")).rejects.toThrow(AftercareError);
    await expect(worker.device.recordCash(id)).rejects.toThrow(AftercareError);
    expect(await worker.device.payments.all()).toEqual([]);
  });

  it("takes one advance up to half the price, and asks for what is left once it is done", async () => {
    const { worker, consumer, id, price, both } = await agreedJob();
    const job = await worker.device.job(id);
    const cap = advanceCap(job);
    expect(cap).toBe(Math.floor(price / 2));
    await expect(worker.device.requestAdvance(id, cap + 1, "Fan")).rejects.toThrow(AftercareError);
    const advance = await worker.device.requestAdvance(id, cap, "Fan");
    await settle(both);
    expect(await consumer.device.payments.get(advance.id)).toMatchObject({ advance: true, amount_paise: cap });
    await expect(worker.device.requestAdvance(id, 100, "Fan")).rejects.toThrow(AftercareError);
    await consumer.device.markPaid(advance.id);
    await settle(both);
    await worker.device.confirmPayment(advance.id);
    await settle(both);

    const held = await worker.device.payments.forEngagement(id);
    expect(paidUp(held)).toBe(false);
    expect(jobProgress(await worker.device.job(id), held)?.find((s) => s.step === Step.paid)?.reached).toBe(false);

    await worker.device.deliver(id, { code: "done" });
    await settle(both);
    const rest = await worker.device.requestPayment(id, "Fan");
    expect(rest.amount_paise).toBe(price - cap);
    expect(rest.advance).toBeUndefined();
    await settle(both);
    expect(await consumer.device.payments.get(rest.id)).toMatchObject({ amount_paise: price - cap });
  });

  it("asks again for the whole price when the advance was disputed", async () => {
    const { worker, id, price, both } = await agreedJob();
    const advance = await worker.device.requestAdvance(id, 1000, "Fan");
    await settle(both);
    await worker.device.disputePayment(advance.id);
    const job = await worker.device.job(id);
    const payments = await worker.device.payments.forEngagement(id);
    expect(balanceDue(job, payments)).toBe(price);
    expect(canAskAdvance(job, payments)).toBe(true);
  });

  it("offers no advance to a phone that only takes the whole price", async () => {
    const { worker, id, price, both } = await agreedJob({
      home: PART_PAYMENTS_PROTOCOL - 1,
      work: PART_PAYMENTS_PROTOCOL,
    });
    expect(await worker.device.takesAdvance(id)).toBe(false);
    await expect(worker.device.requestAdvance(id, 1000, "Fan")).rejects.toThrow(AftercareError);
    await worker.device.deliver(id, { code: "done" });
    await settle(both);
    expect((await worker.device.requestPayment(id, "Fan")).amount_paise).toBe(price);
  });

  it("counts the advance on the household's phone too, so a second one is not fair", async () => {
    const { worker, consumer, id, both } = await agreedJob();
    await worker.device.requestAdvance(id, 1000, "Fan");
    await settle(both);
    const hers = await consumer.device.payments.forEngagement(id);
    expect(hers).toHaveLength(1);
    const job = await consumer.device.job(id);
    expect(canAskAdvance(job, hers)).toBe(false);
  });
});
