import type {
  EngagementId,
  EngagementStatus,
  JobRequest,
  Payment,
  PaymentId,
  PaymentStatus,
  UserId,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type JobRecord, receiptsOf } from "../src/index.js";

const ME = "usr_01J0000000000000000000HHHH" as UserId;
const WORKER = "usr_01J0000000000000000000WWWW" as UserId;
const NEIGHBOUR = "usr_01J0000000000000000000NNNN" as UserId;

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

const REQUEST: JobRequest = {
  trade: "electrician",
  need: "Fan repair",
  when: "tomorrow",
  area: { lat: 12.97, lon: 77.64 },
  details: {},
  lang: "en",
};

/** A job this household asked for. */
function job(status: EngagementStatus = "delivered"): JobRecord {
  const id = `eng_${nextId()}` as EngagementId;
  return {
    engagement: {
      id,
      group: id,
      role: "consumer",
      counterpart: WORKER,
      status,
      brief: { text: "Fan repair", topic: "electrician", shared: {} },
      created_at: "2026-10-01T09:00:00+05:30",
      updated_at: "2026-10-20T09:00:00+05:30",
    },
    request: REQUEST,
    offers: [],
    offers_made: 1,
    asked: false,
  };
}

/** A payment for `j` at `at`, from this household unless `from` says otherwise. */
function pay(j: JobRecord, status: PaymentStatus, at: string, from: UserId = ME, amount = 65_000): Payment {
  return {
    id: `pay_${nextId()}` as PaymentId,
    engagement: j.engagement.id,
    payee: WORKER,
    payer: from,
    amount_paise: amount,
    method: "upi",
    status,
    note: "",
    requested_at: at,
    ...(status === "paid" || status === "confirmed" ? { paid_at: at } : {}),
    ...(status === "confirmed" ? { confirmed_at: at } : {}),
  };
}

describe("receiptsOf", () => {
  it("lists what the household said it paid and what the worker confirmed, newest first", () => {
    const [a, b] = [job(), job("closed")];
    const older = pay(a, "confirmed", "2026-10-10T10:00:00+05:30");
    const newer = pay(b, "paid", "2026-10-21T10:00:00+05:30", ME, 40_000);
    const receipts = receiptsOf([a, b], [older, newer], ME);
    expect(receipts.map((r) => r.payment.id)).toEqual([newer.id, older.id]);
    expect(receipts.map((r) => r.confirmed)).toEqual([false, true]);
    expect(receipts[0]?.job).toBe(b);
  });

  it("leaves out payments only asked for or disputed, someone else's, and those with no job on this phone", () => {
    const a = job();
    const elsewhere = job();
    const payments = [
      pay(a, "requested", "2026-10-10T10:00:00+05:30"),
      pay(a, "disputed", "2026-10-11T10:00:00+05:30"),
      pay(a, "confirmed", "2026-10-12T10:00:00+05:30", NEIGHBOUR),
      pay(elsewhere, "confirmed", "2026-10-13T10:00:00+05:30"),
    ];
    expect(receiptsOf([a], payments, ME)).toEqual([]);
  });
});
