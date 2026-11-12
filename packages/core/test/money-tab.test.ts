import type { Agree, EngagementId, OfferId, Payment, PaymentId, PaymentStatus, Role, UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type JobRecord, paidTotals, passbook, receiptsOf, waitingBy, weekPayments } from "../src/index.js";

const WORKER = "usr_01J0000000000000000000WWWW" as UserId;
const PRIYA = "usr_01J0000000000000000000PPPP" as UserId;
const MEENA = "usr_01J0000000000000000000MMMM" as UserId;
/** India: tests run at UTC+05:30. */
const IST = 330;
/** Thursday 29 October 2026, 10:00 in Bengaluru. The week runs Monday 26 October to Sunday 1 November. */
const NOW = new Date("2026-10-29T10:00:00+05:30");

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

/** A finished job both sides signed, seen from `role`'s phone, done for `household`. */
function job(household: UserId, role: Role = "provider"): JobRecord {
  const id = `eng_${nextId()}` as EngagementId;
  const at = "2026-10-01T09:00:00+05:30";
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${nextId()}` as OfferId,
      worker: WORKER,
      consumer: household,
      trade: "maid",
      scope: "Cleaning",
      slot: "tomorrow 10:00",
      price_paise: 45_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  return {
    engagement: {
      id,
      group: id,
      role,
      counterpart: role === "provider" ? household : WORKER,
      status: "delivered",
      brief: { text: "Cleaning", topic: "maid", shared: {} },
      created_at: at,
      updated_at: at,
    },
    request: {
      trade: "maid",
      need: "Cleaning",
      when: "tomorrow",
      area: { lat: 12.97, lon: 77.64 },
      details: {},
      lang: "en",
    },
    offers: [],
    offers_made: 1,
    asked: false,
    mine: agree,
    theirs: agree,
  };
}

/** A payment on `j` from `payer` to the worker; `at` is when it last moved. */
function pay(j: JobRecord, payer: UserId, status: PaymentStatus, amount: number, at: string): Payment {
  return {
    id: `pay_${nextId()}` as PaymentId,
    engagement: j.engagement.id,
    payee: WORKER,
    payer,
    amount_paise: amount,
    method: "upi",
    status,
    note: "",
    requested_at: at,
    ...(status === "paid" || status === "confirmed" ? { paid_at: at } : {}),
    ...(status === "confirmed" ? { confirmed_at: at } : {}),
  };
}

const rowsOf = (jobs: JobRecord[], payments: Payment[]) => passbook(jobs, payments, WORKER, NOW, IST).rows;

describe("weekPayments", () => {
  it("counts the payments behind the week's total, by the same local week", () => {
    const j = job(PRIYA);
    const payments = [
      pay(j, PRIYA, "confirmed", 100, "2026-10-25T18:40:00Z"), // Monday 26 Oct, 00:10 in India: this week
      pay(j, PRIYA, "confirmed", 200, "2026-10-25T18:20:00Z"), // Sunday 25 Oct, 23:50: last week
      pay(j, PRIYA, "confirmed", 300, "2026-10-28T10:00:00Z"), // Wednesday: this week
      pay(j, PRIYA, "requested", 400, "2026-10-28T10:00:00Z"), // asked, not received
      pay(j, PRIYA, "disputed", 500, "2026-10-28T10:00:00Z"),
    ];
    const rows = rowsOf([j], payments);
    expect(weekPayments(rows, NOW, IST)).toBe(2);
    expect(passbook([j], payments, WORKER, NOW, IST).totals.week).toBe(400);
  });

  it("is zero with nothing received", () => {
    expect(weekPayments([], NOW, IST)).toBe(0);
  });
});

describe("waitingBy", () => {
  it("splits what is waiting by household, the most first, naming each by its newest job", () => {
    const [priyaOld, priyaNew, meena] = [job(PRIYA), job(PRIYA), job(MEENA)];
    const rows = rowsOf(
      [priyaOld, priyaNew, meena],
      [
        pay(priyaOld, PRIYA, "requested", 45_000, "2026-10-26T10:00:00Z"),
        pay(priyaNew, PRIYA, "paid", 45_000, "2026-10-28T10:00:00Z"),
        pay(meena, MEENA, "requested", 60_000, "2026-10-27T10:00:00Z"),
        pay(meena, MEENA, "confirmed", 10_000, "2026-10-27T11:00:00Z"),
      ],
    );
    const waiting = waitingBy(rows);
    expect(waiting.map((w) => [w.household, w.paise])).toEqual([
      [PRIYA, 90_000],
      [MEENA, 60_000],
    ]);
    expect(waiting[0]?.job).toBe(priyaNew);
  });

  it("leaves out confirmed and disputed money, so nobody is named when nothing waits", () => {
    const j = job(PRIYA);
    const rows = rowsOf(
      [j],
      [
        pay(j, PRIYA, "confirmed", 45_000, "2026-10-28T10:00:00Z"),
        pay(j, PRIYA, "disputed", 1, "2026-10-28T11:00:00Z"),
      ],
    );
    expect(waitingBy(rows)).toEqual([]);
  });
});

describe("paidTotals", () => {
  const HOUSEHOLD = PRIYA;
  /** A job on the household's own phone, where the worker is the other side. */
  const hired = () => job(HOUSEHOLD, "requester");

  it("adds up what the household said it paid: in all, this month, not confirmed, and since when", () => {
    const [a, b] = [hired(), hired()];
    const receipts = receiptsOf(
      [a, b],
      [
        pay(a, HOUSEHOLD, "confirmed", 45_000, "2026-09-12T10:00:00Z"), // September
        pay(a, HOUSEHOLD, "confirmed", 45_000, "2026-09-30T18:40:00Z"), // 1 October, 00:10 in India
        pay(b, HOUSEHOLD, "paid", 60_000, "2026-10-28T10:00:00Z"), // not confirmed yet
        pay(b, HOUSEHOLD, "requested", 5_000, "2026-10-28T11:00:00Z"), // asked, not paid
        pay(b, HOUSEHOLD, "disputed", 7_000, "2026-10-28T12:00:00Z"),
      ],
      HOUSEHOLD,
    );
    expect(paidTotals(receipts, NOW, IST)).toEqual({
      all: 150_000,
      month: 105_000,
      unconfirmed: 60_000,
      since: new Date("2026-09-12T10:00:00Z"),
    });
  });

  it("is zero, with no since, before anything was paid", () => {
    expect(paidTotals([], NOW, IST)).toEqual({ all: 0, month: 0, unconfirmed: 0 });
  });
});
