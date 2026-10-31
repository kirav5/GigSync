import type {
  Agree,
  EngagementId,
  EngagementStatus,
  OfferId,
  Payment,
  PaymentId,
  PaymentStatus,
  Role,
  Trade,
  UserId,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { AskAgain, askAgain, type JobRecord, passbook } from "../src/index.js";

const ME = "usr_01J0000000000000000000WWWW" as UserId;
const CUSTOMER = "usr_01J0000000000000000000CCCC" as UserId;
/** India: tests run at UTC+05:30. */
const IST = 330;
/** Thursday 29 October 2026, 10:00 in Bengaluru. The week runs Monday 26 October to Sunday 1 November. */
const NOW = new Date("2026-10-29T10:00:00+05:30");
const DAY_MS = 86_400_000;

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

/** A job seen from the worker's phone, signed by this side and (unless `theirs` is false) by the customer. */
function job(
  opts: { trade?: Trade; status?: EngagementStatus; price?: number; role?: Role; theirs?: boolean } = {},
): JobRecord {
  const id = `eng_${nextId()}` as EngagementId;
  const trade = opts.trade ?? "electrician";
  const at = "2026-10-01T09:00:00+05:30";
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${nextId()}` as OfferId,
      worker: ME,
      consumer: CUSTOMER,
      trade,
      scope: "Fan repair",
      slot: "tomorrow 10:00",
      price_paise: opts.price ?? 65_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  return {
    engagement: {
      id,
      group: id,
      role: opts.role ?? "provider",
      counterpart: CUSTOMER,
      status: opts.status ?? "delivered",
      brief: { text: "Fan repair", topic: trade, shared: {} },
      created_at: at,
      updated_at: at,
    },
    request: { trade, need: "Fan repair", when: "tomorrow", area: { lat: 12.97, lon: 77.64 }, details: {}, lang: "en" },
    offers: [],
    offers_made: 1,
    asked: false,
    mine: agree,
    ...(opts.theirs === false ? {} : { theirs: agree }),
  };
}

/** A payment to this worker for `j`; `at` is when it was confirmed (or, if not confirmed, asked for). */
function pay(j: JobRecord, status: PaymentStatus, amount: number, at: string, payee: UserId = ME): Payment {
  return {
    id: `pay_${nextId()}` as PaymentId,
    engagement: j.engagement.id,
    payee,
    payer: CUSTOMER,
    amount_paise: amount,
    method: "upi",
    status,
    note: "",
    requested_at: at,
    ...(status === "confirmed" ? { paid_at: at, confirmed_at: at } : {}),
  };
}

describe("passbook", () => {
  it("lists only payments to this worker for jobs both sides signed, newest first", () => {
    const signed = job();
    const halfSigned = job({ status: "confirming", theirs: false });
    const hired = job({ role: "requester" });
    const rows = passbook(
      [signed, halfSigned, hired],
      [
        pay(signed, "confirmed", 100, "2026-10-27T10:00:00Z"),
        pay(signed, "requested", 200, "2026-10-28T10:00:00Z"),
        pay(halfSigned, "requested", 300, "2026-10-28T10:00:00Z"),
        pay(hired, "confirmed", 400, "2026-10-28T10:00:00Z"),
        pay(signed, "confirmed", 500, "2026-10-28T11:00:00Z", CUSTOMER),
      ],
      ME,
      NOW,
      IST,
    ).rows;
    expect(rows.map((r) => r.payment.amount_paise)).toEqual([200, 100]);
    expect(rows[0]?.job).toBe(signed);
    expect(rows[0]?.at).toEqual(new Date("2026-10-28T10:00:00Z"));
  });

  it("leaves out payments recorded by hand for jobs agreed outside GigSync", () => {
    const signed = job();
    const manual: Payment = {
      ...pay(signed, "confirmed", 45_000, "2026-10-28T10:00:00Z"),
      engagement: "eng_manual" as EngagementId,
    };
    const { rows, totals } = passbook([signed], [manual], ME, NOW, IST);
    expect(rows).toEqual([]);
    expect(totals.week).toBe(0);
  });

  it("files received money by local week (Monday to Sunday) and calendar month", () => {
    const j = job({ status: "closed" });
    const { totals } = passbook(
      [j],
      [
        pay(j, "confirmed", 1, "2026-10-25T18:40:00Z"), // Monday 26 Oct, 00:10 in India: this week
        pay(j, "confirmed", 10, "2026-10-25T18:20:00Z"), // Sunday 25 Oct, 23:50: last week, this month
        pay(j, "confirmed", 100, "2026-09-30T18:40:00Z"), // Thursday 1 Oct, 00:10: this month
        pay(j, "confirmed", 1000, "2026-09-30T18:20:00Z"), // Wednesday 30 Sep, 23:50: last month
        pay(j, "confirmed", 10000, "2026-11-01T18:20:00Z"), // Sunday 1 Nov, 23:50: still this week, next month
      ],
      ME,
      NOW,
      IST,
    );
    expect(totals.week).toBe(10001);
    expect(totals.month).toBe(111);
  });

  it("counts a disputed payment nowhere", () => {
    const j = job({ status: "agreed" });
    const { rows, totals } = passbook([j], [pay(j, "disputed", 500, "2026-10-28T10:00:00Z")], ME, NOW, IST);
    expect(rows).toHaveLength(1);
    expect(totals).toEqual({ week: 0, month: 0, waiting: 0, notAsked: 0 });
  });

  it("waits on requested and paid money; not asked is done work with nothing but disputes, at the signed price", () => {
    const asked = job({ price: 1000 });
    const claimed = job({ price: 2000 });
    const doneUnasked = job({ status: "closed", price: 4000 });
    const doneDisputed = job({ status: "delivered", price: 8000 });
    const stillWorking = job({ status: "in_progress", price: 16000 });
    const { totals } = passbook(
      [asked, claimed, doneUnasked, doneDisputed, stillWorking],
      [
        pay(asked, "requested", 1000, "2026-10-28T10:00:00Z"),
        pay(claimed, "paid", 2000, "2026-10-28T10:00:00Z"),
        pay(doneDisputed, "disputed", 8000, "2026-10-28T10:00:00Z"),
      ],
      ME,
      NOW,
      IST,
    );
    expect(totals.waiting).toBe(3000);
    expect(totals.notAsked).toBe(12000);
  });
});

describe("askAgain", () => {
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

  it("after the latest payment was disputed", () => {
    const j = job();
    expect(askAgain(j, [pay(j, "disputed", 100, daysAgo(1))], NOW)).toBe(AskAgain.dispute);
    const settled = [pay(j, "disputed", 100, daysAgo(2)), pay(j, "confirmed", 100, daysAgo(1))];
    expect(askAgain(j, settled, NOW)).toBeUndefined();
  });

  it("for monthly work, once the last confirmed payment is 28 days old and nothing is open", () => {
    const cook = job({ trade: "cook", status: "in_progress" });
    expect(askAgain(cook, [pay(cook, "confirmed", 100, daysAgo(27))], NOW)).toBeUndefined();
    expect(askAgain(cook, [pay(cook, "confirmed", 100, daysAgo(28))], NOW)).toBe(AskAgain.month);
    const open = [pay(cook, "confirmed", 100, daysAgo(40)), pay(cook, "requested", 100, daysAgo(1))];
    expect(askAgain(cook, open, NOW)).toBeUndefined();
  });

  it("never for a one-off job that has been paid, however long ago", () => {
    const j = job({ status: "closed" });
    expect(askAgain(j, [pay(j, "confirmed", 100, daysAgo(60))], NOW)).toBeUndefined();
  });
});
