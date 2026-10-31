import type { Engagement } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  buildUpiUri,
  canRequestPayment,
  MemoryStorage,
  newEngagement,
  PaymentBook,
  PaymentError,
  rupees,
  UpiError,
} from "../src/index.js";

const now = new Date("2026-10-25T18:00:00+05:30");
const clock = { now: () => now };
const WORKER = "usr_01J0000000000000000000WWWW";
const CONSUMER = "usr_01J0000000000000000000CCCC";

/** A job seen from the worker's phone: the worker is the provider, the consumer is the counterpart. */
function job(status: Engagement["status"], role: Engagement["role"] = "provider"): Engagement {
  const e = newEngagement(
    { role, counterpart: CONSUMER, brief: { text: "House cleaning, Mon-Fri", topic: "cleaning", shared: {} } },
    now,
  );
  return { ...e, status };
}

describe("buildUpiUri", () => {
  const base = { vpa: "sita.devi@okaxis", name: "Sita Devi", amountPaise: 45_000, note: "Cleaning", ref: "pay_X" };

  it("builds an NPCI UPI link with rupees to two decimals", () => {
    const uri = buildUpiUri(base);
    expect(uri.startsWith("upi://pay?")).toBe(true);
    const q = new URLSearchParams(uri.split("?")[1]);
    expect(q.get("pa")).toBe("sita.devi@okaxis");
    expect(q.get("pn")).toBe("Sita Devi");
    expect(q.get("am")).toBe("450.00");
    expect(q.get("cu")).toBe("INR");
    expect(q.get("tn")).toBe("Cleaning");
    expect(q.get("tr")).toBe("pay_X");
    expect(uri).not.toContain("+");
    expect(uri).toContain("pa=sita.devi@okaxis&");
  });
  it("formats paise exactly", () => {
    expect(rupees(5)).toBe("0.05");
    expect(rupees(12_345)).toBe("123.45");
  });
  it("refuses a bad UPI ID or amount", () => {
    expect(() => buildUpiUri({ ...base, vpa: "sita" })).toThrow(UpiError);
    expect(() => buildUpiUri({ ...base, amountPaise: 99.5 })).toThrow(UpiError);
    expect(() => buildUpiUri({ ...base, amountPaise: 0 })).toThrow(UpiError);
  });
  it("strips characters UPI apps reject from name and note", () => {
    const q = new URLSearchParams(buildUpiUri({ ...base, name: "Sita & Co <x>", note: "₹450 #3" }).split("?")[1]);
    expect(q.get("pn")).toBe("Sita  Co x");
    expect(q.get("tn")).toBe("450 3");
  });
  it("keeps Hindi names", () => {
    const q = new URLSearchParams(buildUpiUri({ ...base, name: "सीता देवी" }).split("?")[1]);
    expect(q.get("pn")).toBe("सीता देवी");
  });
});

describe("PaymentBook", () => {
  const book = () => new PaymentBook(new MemoryStorage(), clock);

  it("only the worker can ask, and only once the job is agreed", () => {
    expect(canRequestPayment(job("agreed"))).toBe(true);
    expect(canRequestPayment(job("delivered"))).toBe(true);
    expect(canRequestPayment(job("sent"))).toBe(false);
    expect(canRequestPayment(job("agreed", "requester"))).toBe(false);
  });

  it("records a payment against the job: requested → paid → confirmed", async () => {
    const b = book();
    const e = job("delivered");
    const p = await b.request({ engagement: e, payee: WORKER, amountPaise: 45_000, note: "Week 1" });
    expect(p).toMatchObject({ engagement: e.id, payer: CONSUMER, payee: WORKER, status: "requested", method: "upi" });
    expect(await b.summary(e.id)).toEqual({ requested: 45_000, paid: 0, confirmed: 0, outstanding: 45_000 });

    await b.markPaid(p.id, "412345678901");
    const done = await b.confirm(p.id);
    expect(done).toMatchObject({ status: "confirmed", utr: "412345678901" });
    expect(await b.summary(e.id)).toEqual({ requested: 45_000, paid: 45_000, confirmed: 45_000, outstanding: 0 });
  });

  it("lets the worker confirm cash directly, and dispute instead of confirming", async () => {
    const b = book();
    const e = job("in_progress");
    const cash = await b.request({ engagement: e, payee: WORKER, amountPaise: 20_000, note: "", method: "cash" });
    expect((await b.confirm(cash.id)).paid_at).toBe(now.toISOString());
    const upi = await b.request({ engagement: e, payee: WORKER, amountPaise: 10_000, note: "" });
    await b.dispute(upi.id);
    await expect(b.confirm(upi.id)).rejects.toThrow(PaymentError);
    expect((await b.summary(e.id)).requested).toBe(20_000);
  });

  it("refuses a malformed UPI reference and a job that is not agreed", async () => {
    const b = book();
    const p = await b.request({ engagement: job("agreed"), payee: WORKER, amountPaise: 100, note: "" });
    await expect(b.markPaid(p.id, "123")).rejects.toThrow(PaymentError);
    await expect(b.request({ engagement: job("sent"), payee: WORKER, amountPaise: 100, note: "" })).rejects.toThrow(
      PaymentError,
    );
  });

  it("applies the consumer's 'paid' record, but never lets it confirm", async () => {
    const b = book();
    const p = await b.request({ engagement: job("delivered"), payee: WORKER, amountPaise: 100, note: "" });
    const theirs = { ...p, status: "confirmed" as const };
    expect((await b.receive(theirs, p.payer)).status).toBe("requested");
    expect((await b.receive({ ...p, status: "paid", utr: "412345678901" }, p.payer)).status).toBe("paid");
  });

  it("takes 'confirmed' and 'disputed' only from the worker who is paid", async () => {
    const b = book();
    const p = await b.request({ engagement: job("delivered"), payee: WORKER, amountPaise: 100, note: "" });
    await b.receive({ ...p, status: "paid" }, p.payer);
    expect((await b.receive({ ...p, status: "disputed" }, p.payer)).status).toBe("paid");
    expect((await b.receive({ ...p, status: "confirmed" }, WORKER)).status).toBe("confirmed");
  });

  it("confirms cash from an open payment, dropping any UPI reference, and never twice", async () => {
    const b = book();
    const e = job("delivered");
    const asked = await b.request({ engagement: e, payee: WORKER, amountPaise: 100, note: "" });
    expect(await b.confirmCash(asked.id)).toMatchObject({
      status: "confirmed",
      method: "cash",
      paid_at: now.toISOString(),
      confirmed_at: now.toISOString(),
    });
    await expect(b.confirmCash(asked.id)).rejects.toThrow(PaymentError);

    const claimed = await b.request({ engagement: e, payee: WORKER, amountPaise: 200, note: "" });
    await b.markPaid(claimed.id, "412345678901");
    const cash = await b.confirmCash(claimed.id);
    expect(cash).toMatchObject({ status: "confirmed", method: "cash" });
    expect(cash.utr).toBeUndefined();
  });

  it("takes a change to cash only from the worker who is paid, and only with 'confirmed'", async () => {
    const b = book();
    const p = await b.request({ engagement: job("delivered"), payee: WORKER, amountPaise: 100, note: "" });
    expect(await b.receive({ ...p, status: "paid", method: "cash" }, p.payer)).toMatchObject({
      status: "paid",
      method: "upi",
    });
    expect(await b.receive({ ...p, status: "confirmed", method: "cash" }, p.payer)).toMatchObject({ method: "upi" });
    expect(await b.receive({ ...p, status: "confirmed", method: "cash" }, WORKER)).toMatchObject({
      status: "confirmed",
      method: "cash",
    });
  });

  it("refuses a new payment that is not the worker's request", async () => {
    const b = book();
    const p = await b.request({ engagement: job("delivered"), payee: WORKER, amountPaise: 100, note: "" });
    const forged = { ...p, id: "pay_01J0000000000000000000FORG" as typeof p.id, status: "confirmed" as const };
    await expect(b.receive(forged, WORKER)).rejects.toThrow(PaymentError);
  });
});
