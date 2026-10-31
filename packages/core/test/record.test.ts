import type {
  Agree,
  EngagementId,
  EngagementStatus,
  OfferId,
  Payment,
  PaymentId,
  PaymentMethod,
  PaymentStatus,
  Role,
  UserId,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { EVERY_DAY, type JobRecord, localDay, RecordState, workRecord } from "../src/index.js";

const ME = "usr_01J0000000000000000000WWWW" as UserId;
const CUSTOMER = "usr_01J0000000000000000000CCCC" as UserId;
const NEIGHBOUR = "usr_01J0000000000000000000NNNN" as UserId;
const HELPER = "usr_01J0000000000000000000HHHH" as UserId;
/** India: UTC+05:30. */
const IST = 330;
/** Thursday 29 October 2026, 10:00 in Bengaluru. */
const NOW = new Date("2026-10-29T10:00:00+05:30");

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

interface JobOpts {
  status?: EngagementStatus;
  role?: Role;
  counterpart?: UserId;
  /** When the engagement last moved: the hand-over for delivered work. */
  at?: string;
  /** The request's `details.day`. */
  day?: string;
  price?: number;
  /** false: the other side never signed; "other": they signed different terms. */
  theirs?: false | "other";
}

/** A job on this phone, signed by this side and (unless `theirs` says otherwise) by the other on the same terms. */
function job(opts: JobOpts = {}): JobRecord {
  const id = `eng_${nextId()}` as EngagementId;
  const role = opts.role ?? "provider";
  const other = opts.counterpart ?? (role === "provider" ? CUSTOMER : HELPER);
  const at = opts.at ?? "2026-10-20T09:00:00+05:30";
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${nextId()}` as OfferId,
      worker: role === "provider" ? ME : other,
      consumer: role === "provider" ? other : ME,
      trade: "electrician",
      scope: "Fan repair",
      slot: "tomorrow 10:00",
      price_paise: opts.price ?? 65_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  const theirs = opts.theirs === "other" ? { ...agree, terms_hash: "b".repeat(64) } : agree;
  return {
    engagement: {
      id,
      group: id,
      role,
      counterpart: other,
      status: opts.status ?? "delivered",
      brief: { text: "Fan repair", topic: "electrician", shared: {} },
      created_at: "2026-10-01T09:00:00+05:30",
      updated_at: at,
    },
    request: {
      trade: "electrician",
      need: "Fan repair",
      when: "tomorrow",
      area: { lat: 12.97, lon: 77.64 },
      details: opts.day ? { day: opts.day } : {},
      lang: "en",
    },
    offers: [],
    offers_made: 1,
    asked: false,
    mine: agree,
    ...(opts.theirs === false ? {} : { theirs }),
  };
}

/** A payment for `j`, moved to `status` at `at`; to this worker unless `from` and `to` say otherwise. */
function pay(
  j: JobRecord,
  status: PaymentStatus,
  at: string,
  opts: { amount?: number; method?: PaymentMethod; to?: UserId; from?: UserId; utr?: string } = {},
): Payment {
  return {
    id: `pay_${nextId()}` as PaymentId,
    engagement: j.engagement.id,
    payee: opts.to ?? ME,
    payer: opts.from ?? CUSTOMER,
    amount_paise: opts.amount ?? 65_000,
    method: opts.method ?? "upi",
    status,
    note: "",
    requested_at: at,
    ...(status === "paid" || status === "confirmed" ? { paid_at: at } : {}),
    ...(status === "confirmed" ? { confirmed_at: at } : {}),
    ...(status === "disputed" ? { disputed_at: at } : {}),
    ...(opts.utr ? { utr: opts.utr } : {}),
  };
}

const record = (jobs: JobRecord[], payments: Payment[] = [], offset = IST) =>
  workRecord(jobs, payments, ME, NOW, offset);
const ids = (rows: readonly { job: JobRecord }[]) => rows.map((r) => r.job.engagement.id);
const idsOf = (jobs: readonly JobRecord[]) => jobs.map((j) => j.engagement.id);

describe("workRecord", () => {
  it("files each job under its local month in IST, newest first", () => {
    const lateSeptember = job({ at: "2026-09-30T18:00:00Z" }); // 23:30 on 30 September in Bengaluru
    const earlyOctober = job({ at: "2026-09-30T19:00:00Z" }); // 00:30 on 1 October in Bengaluru
    const signedDay = job({ day: "2026-10-20", at: "2026-10-25T10:00:00+05:30" });
    const r = record([lateSeptember, signedDay, earlyOctober]);
    expect(r.months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(ids(r.months[0]?.rows ?? [])).toEqual(idsOf([signedDay, earlyOctober]));
    expect(ids(r.months[1]?.rows ?? [])).toEqual(idsOf([lateSeptember]));
    // Each day is midday on the phone, so it reads back as the same local date.
    expect(r.months[0]?.rows.map((row) => localDay(row.day, IST))).toEqual(["2026-10-20", "2026-10-01"]);
    // On a phone at UTC, the 30 September hand-over at 19:00 is still September.
    expect(record([earlyOctober], [], 0).months.map((m) => m.month)).toEqual(["2026-09"]);
  });

  it("uses the signed day once it has come, and the hand-over day otherwise", () => {
    const early = job({ day: "2026-11-02", at: "2026-10-28T17:00:00+05:30" }); // done before its day
    const daily = job({ day: EVERY_DAY, at: "2026-10-27T08:00:00+05:30" });
    const [a, b] = record([early, daily]).months[0]?.rows ?? [];
    expect(localDay(a?.day ?? NOW, IST)).toBe("2026-10-28");
    expect(localDay(b?.day ?? NOW, IST)).toBe("2026-10-27");
  });

  it("keeps a job cancelled after signing as a row, out of the counts", () => {
    const done = job({ at: "2026-10-05T10:00:00+05:30" });
    const cancelled = job({ status: "cancelled", counterpart: NEIGHBOUR, at: "2026-10-26T10:00:00+05:30" });
    const r = record([done, cancelled]);
    expect(r.months[0]?.rows.map((row) => row.state)).toEqual([RecordState.cancelled, RecordState.notAsked]);
    expect(r.jobs).toBe(1);
    expect(r.households).toBe(1);
    expect(localDay(r.since ?? NOW, IST)).toBe("2026-10-05");
  });

  it("leaves out jobs not signed by both on the same terms, and signed work not finished yet", () => {
    const halfSigned = job({ status: "cancelled", theirs: false });
    const otherTerms = job({ theirs: "other" });
    const underway = job({ status: "in_progress" });
    const r = record([halfSigned, otherTerms, underway]);
    expect(r.months).toEqual([]);
    expect(r.jobs).toBe(0);
    expect(r.since).toBeUndefined();
    // The work under way is signed, so the record is waiting for it, not empty of everything.
    expect(r.signed).toBe(1);
  });

  it("leaves jobs this phone hired out of the record, whatever it paid", () => {
    const hired = job({ role: "requester", status: "closed", price: 50_000 });
    const unpaid = job({ role: "requester", status: "agreed", at: "2026-10-10T10:00:00+05:30" });
    const dropped = job({ role: "requester", status: "cancelled" });
    const r = record(
      [hired, unpaid, dropped],
      [
        pay(hired, "confirmed", "2026-10-21T10:00:00Z", { amount: 30_000, to: HELPER, from: ME }),
        pay(hired, "confirmed", "2026-10-22T10:00:00Z", { amount: 20_000, to: HELPER, from: ME }),
        pay(hired, "requested", "2026-10-23T10:00:00Z", { amount: 9_000, to: HELPER, from: ME }),
        pay(unpaid, "disputed", "2026-10-23T10:00:00Z", { to: HELPER, from: ME }),
      ],
    );
    expect(r.months).toEqual([]);
    expect(r.jobs).toBe(0);
    expect(r.signed).toBe(0);
  });

  it("shows the confirmed payment on a job paid again after a dispute", () => {
    const j = job();
    const disputed = pay(j, "disputed", "2026-10-21T10:00:00Z");
    const confirmed = pay(j, "confirmed", "2026-10-22T10:00:00Z", { utr: "412345678901" });
    const [row] = record([j], [confirmed, disputed]).months[0]?.rows ?? [];
    expect(row?.state).toBe(RecordState.received);
    expect(row?.payment).toBe(confirmed);
  });

  it("shows a new month's ask on monthly work paid the month before as waiting", () => {
    const j = job();
    const paid = pay(j, "confirmed", "2026-09-30T10:00:00Z");
    const asked = pay(j, "requested", "2026-10-28T10:00:00Z");
    const [row] = record([j], [paid, asked]).months[0]?.rows ?? [];
    expect(row?.state).toBe(RecordState.waiting);
    expect(row?.payment).toBe(asked);
  });

  it("reads the money state from payments to this phone only", () => {
    const cash = job();
    const asked = job();
    const claimed = job();
    const disputed = job();
    const elsewhere = job();
    const state = (j: JobRecord, r: ReturnType<typeof record>) =>
      r.months.flatMap((m) => m.rows).find((row) => row.job === j)?.state;
    const r = record(
      [cash, asked, claimed, disputed, elsewhere],
      [
        pay(cash, "confirmed", "2026-10-21T10:00:00Z", { method: "cash" }),
        pay(asked, "requested", "2026-10-21T10:00:00Z"),
        pay(claimed, "paid", "2026-10-21T10:00:00Z"),
        pay(disputed, "disputed", "2026-10-21T10:00:00Z"),
        pay(elsewhere, "confirmed", "2026-10-21T10:00:00Z", { to: NEIGHBOUR }),
      ],
    );
    expect(state(cash, r)).toBe(RecordState.cash);
    expect(state(asked, r)).toBe(RecordState.waiting);
    expect(state(claimed, r)).toBe(RecordState.waiting);
    expect(state(disputed, r)).toBe(RecordState.notAsked);
    expect(state(elsewhere, r)).toBe(RecordState.notAsked);
  });

  it("counts each household once, since the oldest finished job", () => {
    const first = job({ status: "closed", at: "2026-08-14T10:00:00+05:30" });
    const again = job({ at: "2026-10-02T10:00:00+05:30" });
    const neighbour = job({ counterpart: NEIGHBOUR, at: "2026-09-09T10:00:00+05:30" });
    const r = record([again, first, neighbour]);
    expect(r.jobs).toBe(3);
    expect(r.households).toBe(2);
    expect(localDay(r.since ?? NOW, IST)).toBe("2026-08-14");
    expect(r.months.map((m) => m.month)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });

  it("is empty for a phone with nothing signed", () => {
    expect(record([job({ status: "negotiating", theirs: false })])).toEqual({
      months: [],
      jobs: 0,
      households: 0,
      signed: 0,
    });
  });
});
