import type { EngagementId, Payee, Payment, PaymentId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  AftercareError,
  AskAgain,
  askAgain,
  PayeeMissingError,
  sendPaymentRecord,
  settle,
  TaskKind,
} from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, type Phone, PRIYA, phone, RAVI, RAVI_PAYEE } from "./phones.js";

/** A job both owners have signed, ready for the work and the money. Ravi has saved his UPI ID unless `payee` is null. */
async function agreedJob(payee: Payee | null = RAVI_PAYEE) {
  const relay = new MemoryRelay();
  const worker = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true, ...(payee ? { payee } : {}) });
  const consumer = await phone(relay, PRIYA, { autoConfirm: true });
  const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
  const id = job?.engagement.id as EngagementId;
  await settle([consumer.device, worker.device]);
  const price = (await worker.device.job(id)).mine?.terms.price_paise as number;
  return { relay, worker, consumer, id, price, both: [consumer.device, worker.device] };
}

async function paymentRequested(worker: Phone, id: EngagementId, both: Phone["device"][]) {
  await worker.device.update(id, "On my way, 10 minutes");
  await worker.device.deliver(id, "Capacitor replaced, fan working");
  const asked = await worker.device.requestPayment(id, "Fan repair");
  await settle(both);
  return asked;
}

const kinds = (relay: MemoryRelay, kind: string) => relay.stored.filter((e) => e.kind === kind).length;

describe("after the deal", () => {
  it("runs work, a UPI payment the worker confirms, and the consumer's review", async () => {
    const { relay, worker, consumer, id, price, both } = await agreedJob();
    const asked = await paymentRequested(worker, id, both);
    expect((await consumer.device.job(id)).engagement.status).toBe("delivered");

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

  it("records a dispute on both phones when the money did not arrive, and then lets the worker ask again", async () => {
    const { worker, consumer, id, both } = await agreedJob();
    const asked = await paymentRequested(worker, id, both);
    await consumer.device.markPaid(asked.id, "412345678902");
    await settle(both);
    await worker.device.disputePayment(asked.id);
    await settle(both);
    expect((await consumer.device.payments.get(asked.id))?.status).toBe("disputed");
    expect((await worker.device.payments.get(asked.id))?.status).toBe("disputed");

    const job = await worker.device.job(id);
    expect(askAgain(job, await worker.device.payments.all(), new Date())).toBe(AskAgain.dispute);
    const again = await worker.device.requestPayment(id, "Fan repair");
    await settle(both);
    expect(again.id).not.toBe(asked.id);
    expect((await consumer.device.payments.get(again.id))?.status).toBe("requested");
  });

  it("refuses to ask for payment before the job is signed", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician(), payee: RAVI_PAYEE });
    const consumer = await phone(relay, PRIYA);
    const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
    await settle([consumer.device, worker.device]);
    await expect(worker.device.requestPayment(job?.engagement.id as EngagementId, "early")).rejects.toThrow();
  });

  it("with no UPI ID saved, asking fails before anything is saved or sent", async () => {
    const { relay, worker, id } = await agreedJob(null);
    await expect(worker.device.requestPayment(id, "Fan repair")).rejects.toThrow(PayeeMissingError);
    expect(await worker.device.payments.all()).toEqual([]);
    expect(kinds(relay, "payment_request")).toBe(0);
  });

  it("refuses a second request while one is open", async () => {
    const { relay, worker, id, both } = await agreedJob();
    await paymentRequested(worker, id, both);
    await expect(worker.device.requestPayment(id, "again")).rejects.toThrow(AftercareError);
    expect(await worker.device.payments.all()).toHaveLength(1);
    expect(kinds(relay, "payment_request")).toBe(1);
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

describe("cash", () => {
  it("turns an open UPI request into cash, confirmed on both phones", async () => {
    const { worker, consumer, id, both } = await agreedJob();
    const asked = await paymentRequested(worker, id, both);
    const cash = await worker.device.recordCash(id);
    await settle(both);
    expect(cash.id).toBe(asked.id);
    for (const p of [await worker.device.payments.get(asked.id), await consumer.device.payments.get(asked.id)])
      expect(p).toMatchObject({ status: "confirmed", method: "cash" });
  });

  it("with nothing open, asks and confirms in two records the other phone takes in order", async () => {
    const { relay, worker, consumer, id, price, both } = await agreedJob(null);
    const cash = await worker.device.recordCash(id);
    await settle(both);
    expect(kinds(relay, "payment_record")).toBe(2);
    expect(kinds(relay, "payment_request")).toBe(0);
    expect(await consumer.device.payments.get(cash.id)).toMatchObject({
      status: "confirmed",
      method: "cash",
      amount_paise: price,
    });
  });

  it("ignores a payment the phone has never seen unless it is at the signed price", async () => {
    const { worker, consumer, id, price, both } = await agreedJob();
    // The worker's phone, misbehaving: it sends a payment of its own making straight to the customer.
    const ctx = Reflect.get(worker.device, "ctx") as Parameters<typeof sendPaymentRecord>[0];
    const forged = (amount: number, n: string): Payment => ({
      id: `pay_01J00000000000000000000${n}` as PaymentId,
      engagement: id,
      payee: worker.user,
      payer: consumer.user,
      amount_paise: amount,
      method: "upi",
      status: "requested",
      note: "",
      requested_at: new Date().toISOString(),
    });
    await sendPaymentRecord(ctx, await worker.device.job(id), forged(price + 100_000, "001"));
    await sendPaymentRecord(ctx, await worker.device.job(id), forged(price, "002"));
    await settle(both);
    expect(await consumer.device.payments.get(forged(0, "001").id)).toBeUndefined();
    expect((await consumer.device.payments.get(forged(0, "002").id))?.amount_paise).toBe(price);
  });
});

describe("the worker's own QR", () => {
  it("links to the UPI ID saved in settings, for an open payment", async () => {
    const { worker, id, price, both } = await agreedJob();
    const asked = await paymentRequested(worker, id, both);
    const link = await worker.device.myUpiLink(asked.id);
    expect(link).toContain("pa=ravi.test@okaxis");
    expect(link).toContain(`am=${(price / 100).toFixed(2)}`);
    expect(link).toContain(`tr=${asked.id}`);
  });

  it("says the UPI ID is missing when none is saved", async () => {
    const { worker, id } = await agreedJob(null);
    const open = await worker.device.payments.request({
      engagement: (await worker.device.job(id)).engagement,
      payee: worker.user,
      amountPaise: 100,
      note: "",
    });
    await expect(worker.device.myUpiLink(open.id)).rejects.toThrow(PayeeMissingError);
  });
});
