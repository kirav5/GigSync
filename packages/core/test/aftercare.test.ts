import type { EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { settle, TaskKind } from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, type Phone, PRIYA, phone, RAVI } from "./phones.js";

/** A job both owners have signed, ready for the work and the money. */
async function agreedJob() {
  const relay = new MemoryRelay();
  const worker = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true });
  const consumer = await phone(relay, PRIYA, { autoConfirm: true });
  const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
  const id = job?.engagement.id as EngagementId;
  await settle([consumer.device, worker.device]);
  return { relay, worker, consumer, id, both: [consumer.device, worker.device] };
}

async function paymentRequested(worker: Phone, id: EngagementId, both: Phone["device"][]) {
  await worker.device.update(id, "On my way, 10 minutes");
  await worker.device.deliver(id, "Capacitor replaced, fan working");
  const asked = await worker.device.requestPayment(id, "Fan repair");
  await settle(both);
  return asked;
}

describe("after the deal", () => {
  it("runs work, a UPI payment the worker confirms, and the consumer's review", async () => {
    const { relay, worker, consumer, id, both } = await agreedJob();
    const asked = await paymentRequested(worker, id, both);
    expect((await consumer.device.job(id)).engagement.status).toBe("delivered");

    const price = (await consumer.device.job(id)).mine?.terms.price_paise as number;
    expect(asked.amount_paise).toBe(price);
    const link = await consumer.device.upiLink(asked.id);
    expect(link).toContain("pa=ravi.test@okaxis");
    expect(link).toContain(`am=${(price / 100).toFixed(2)}`);
    expect(JSON.stringify(relay.stored)).not.toContain("ravi.test@okaxis");

    await consumer.device.markPaid(asked.id, "412345678901");
    await settle(both);
    const [task] = await worker.device.tasks();
    expect(task?.kind).toBe(TaskKind.confirmPayment);
    await worker.device.confirmPayment(asked.id);
    await settle(both);
    expect((await consumer.device.payments.get(asked.id))?.status).toBe("confirmed");
    expect((await worker.device.payments.get(asked.id))?.utr).toBe("412345678901");
    expect(await worker.device.tasks()).toEqual([]);

    await consumer.device.review(id, { stars: 5, text: "Quick and tidy" });
    await settle(both);
    expect((await worker.device.job(id)).review).toEqual({ stars: 5, text: "Quick and tidy" });
    expect((await worker.device.job(id)).engagement.status).toBe("closed");
  });

  it("records a dispute on both phones when the money did not arrive", async () => {
    const { worker, consumer, id, both } = await agreedJob();
    const asked = await paymentRequested(worker, id, both);
    await consumer.device.markPaid(asked.id, "412345678902");
    await settle(both);
    await worker.device.disputePayment(asked.id);
    await settle(both);
    expect((await consumer.device.payments.get(asked.id))?.status).toBe("disputed");
    expect((await worker.device.payments.get(asked.id))?.status).toBe("disputed");
  });

  it("refuses to ask for payment before the job is signed", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician() });
    const consumer = await phone(relay, PRIYA);
    const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
    await settle([consumer.device, worker.device]);
    await expect(worker.device.requestPayment(job?.engagement.id as EngagementId, "early")).rejects.toThrow();
  });

  it("a cancel after signing makes the other phone forget the contact card", async () => {
    const { worker, consumer, id, both } = await agreedJob();
    expect((await worker.device.job(id)).contact).toEqual(PRIYA);
    await consumer.device.cancelJob(id, "Fixed it myself");
    await settle(both);
    const w = await worker.device.job(id);
    expect(w.engagement.status).toBe("cancelled");
    expect(w.contact).toBeUndefined();
  });
});
