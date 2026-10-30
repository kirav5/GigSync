import {
  type Agree,
  type EngagementId,
  type EngagementStatus,
  type ExportedJob,
  JobRecordSubmit,
  type OfferId,
  type Payment,
  type PaymentId,
  type Role,
  type Terms,
  type Trade,
  type UserId,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  bothSigned,
  type JobRecord,
  jobWork,
  myWorkRecord,
  outcomeOf,
  paymentOf,
  recordCsv,
  recordsDue,
  submissionOf,
  workTotals,
} from "../src/index.js";
import { FakeRecords } from "./records-fakes.js";

const WORKER = "usr_01J0000000000000000000WWWW" as UserId;
const HOUSEHOLD = "usr_01J0000000000000000000HHHH" as UserId;
const ID = "eng_01J00000000000000000000001" as EngagementId;

interface JobOpts {
  trade?: Trade;
  role?: Role;
  status?: EngagementStatus;
  details?: Record<string, string>;
  answers?: Record<string, string>;
  terms?: Terms;
  stars?: number;
}

/** A job both signed, as one phone holds it. */
function job(o: JobOpts = {}): JobRecord {
  const trade = o.trade ?? "painter";
  const agree: Agree = {
    terms: {
      engagement: ID,
      offer_id: "off_01J00000000000000000000001" as OfferId,
      worker: WORKER,
      consumer: HOUSEHOLD,
      trade,
      scope: "Paint the flat; call 9800000101 at Flat 302",
      slot: "Saturday morning",
      price_paise: 1_200_000,
      ...(o.terms ? { terms: o.terms } : {}),
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  return {
    engagement: {
      id: ID,
      group: ID,
      role: o.role ?? "provider",
      counterpart: o.role === "requester" ? WORKER : HOUSEHOLD,
      status: o.status ?? "agreed",
      brief: { text: "Paint", topic: trade, shared: {} },
      created_at: "2026-10-01T09:00:00+05:30",
      updated_at: "2026-10-02T09:00:00+05:30",
    },
    request: {
      trade,
      need: "Paint my flat at 12, 4th Block",
      when: "Saturday",
      area: { lat: 12.93, lon: 77.58 },
      details: o.details ?? {},
      lang: "en",
    },
    offers: [],
    offers_made: 1,
    asked: true,
    mine: agree,
    theirs: agree,
    ...(o.answers ? { answers: o.answers } : {}),
    ...(o.stars === undefined ? {} : { review: { stars: o.stars, text: "Lovely work, call me on 9800000101" } }),
  };
}

const signed = (r: JobRecord) => {
  if (!bothSigned(r)) throw new Error("fixture is not signed");
  return r;
};

describe("the facts a job record carries", () => {
  it("keeps the trade's scope buckets only, never words a person typed", () => {
    const r = job({
      details: { rooms: "3", pets: "a small dog", problem: "leak near the gas line", area_sqft: "1200 sq ft" },
      answers: { labour_only: "yes", route: "via 5th Cross" },
    });
    expect(jobWork(signed(r))).toEqual({ trade: "painter", scope: { rooms: "bhk3", labour_only: "yes" } });
  });

  it("buckets counts typed in Indian scripts, and takes the trade's default for what was skipped", () => {
    const r = job({ trade: "cook", details: { people: "५" }, answers: { meals: "skipped" } });
    expect(jobWork(signed(r))).toEqual({ trade: "cook", scope: { people: "5_plus", meals: "2" } });
  });

  it("maps a repair's problem only from the app's own choices, never from free text", () => {
    expect(jobWork(signed(job({ trade: "plumber", details: { problem: "leak" } })))?.scope).toEqual({
      problem: "leak",
    });
    expect(jobWork(signed(job({ trade: "plumber", details: { problem: "water everywhere" } })))?.scope).toEqual({
      problem: "other",
    });
  });

  it("takes who buys the paint from the signed terms, over a detail either agent moved", () => {
    const r = job({ details: { labour_only: "no" }, terms: { materials: "household" } });
    expect(jobWork(signed(r))?.scope).toMatchObject({ labour_only: "yes" });
  });

  it("submits the signed price, terms and parties, and nothing of the scope's or slot's words", () => {
    const terms: Terms = { when: { day: "2026-11-07", window: "morning" }, coats: 2, materials: "worker" };
    const s = submissionOf(signed(job({ terms })));
    expect(s).toMatchObject({ counterpart: HOUSEHOLD, role: "provider", price_paise: 1_200_000, terms });
    expect(JobRecordSubmit.safeParse(s).success).toBe(true);
    const sent = JSON.stringify(s);
    for (const words of ["9800000101", "Flat 302", "Saturday", "4th Block"]) expect(sent).not.toContain(words);
  });

  it("says how a signed job ended only once it did", () => {
    expect(outcomeOf(signed(job()))).toBeUndefined();
    expect(outcomeOf(signed(job({ status: "delivered" })))).toEqual({ status: "done" });
    expect(outcomeOf(signed(job({ status: "cancelled" })))).toEqual({ status: "cancelled" });
  });
});

const payment = (status: Payment["status"]): Payment => ({
  id: "pay_01J00000000000000000000001" as PaymentId,
  engagement: ID,
  payee: WORKER,
  payer: HOUSEHOLD,
  amount_paise: 1_200_000,
  method: "upi",
  status,
  note: "Painting",
  utr: "412345678901",
  paid_at: "2026-11-07T12:00:00+05:30",
  ...(status === "confirmed" ? { confirmed_at: "2026-11-07T13:00:00+05:30" } : {}),
});

describe("what a phone owes the server", () => {
  it("is the worker's confirmed payment without its UPI reference, and the household's stars without the words", () => {
    const due = recordsDue([job({ status: "closed", stars: 4 })], [payment("confirmed")]);
    expect(due.map((d) => d.kind)).toEqual(["job", "status", "payment"]);
    const household = recordsDue([job({ role: "requester", status: "closed", stars: 4 })], [payment("confirmed")]);
    expect(household.map((d) => d.kind)).toEqual(["job", "status", "stars"]);
    expect(due.find((d) => d.kind === "payment")?.body).toEqual({
      payment: "pay_01J00000000000000000000001",
      amount_paise: 1_200_000,
      method: "upi",
      paid_on: expect.stringMatching(/^2026-11-0[67]$/),
    });
    const sent = JSON.stringify([due, household]);
    expect(sent).not.toContain("412345678901");
    expect(sent).not.toContain("Lovely");
  });

  it("is never a payment not yet confirmed, nor one from the household's side", () => {
    expect(paymentOf(signed(job()), payment("paid"))).toBeUndefined();
    expect(paymentOf(signed(job({ role: "requester" })), payment("confirmed"))).toBeUndefined();
  });

  it("is nothing for a job only one side signed", () => {
    const { theirs: _, ...half } = job();
    expect(recordsDue([half], [])).toEqual([]);
  });
});

describe("My work record as a file", () => {
  const exported = (o: Partial<ExportedJob>): ExportedJob => ({
    engagement: ID,
    role: "provider",
    counterpart: HOUSEHOLD,
    work: { trade: "cook", scope: { people: "3_4", meals: "2" } },
    terms: {},
    price_paise: 950_000,
    status: "done",
    attested: true,
    agreed_at: "2026-10-03T09:00:00Z",
    payments: [],
    ...o,
  });

  it("is one row per job, oldest first, in the worker's words, with who confirmed it and confirmed money only", () => {
    const jobs = [
      exported({
        stars: 5,
        payments: [
          {
            payment: "pay_01J00000000000000000000001" as PaymentId,
            amount_paise: 950_000,
            paid_on: "2026-10-04",
            method: "cash",
            confirmed: true,
          },
          {
            payment: "pay_01J00000000000000000000002" as PaymentId,
            amount_paise: 100,
            paid_on: "2026-10-05",
            method: "upi",
            confirmed: false,
          },
        ],
      }),
      exported({
        work: { trade: "painter", scope: { labour_only: "yes" } },
        terms: { when: { day: "2026-09-01", window: "morning" } },
        price_paise: 1_200_000,
        status: "cancelled",
        attested: false,
        agreed_at: "2026-08-30T09:00:00Z",
      }),
    ];
    const heading = {
      date: "Date",
      work: "Work",
      price: "Price, ₹",
      paid: "Paid",
      method: "How",
      status: "Status",
      attested: "Confirmed by",
      stars: "Stars",
    };
    const csv = recordCsv(jobs, {
      heading,
      word: (_kind, value) => (value === "painter" ? "Painting, walls" : value),
      attested: (both) => (both ? "Both" : "You only"),
    });
    expect(csv.split("\r\n")).toEqual([
      'Date,Work,"Price, ₹",Paid,How,Status,Confirmed by,Stars',
      '2026-09-01,"Painting, walls",12000.00,0.00,,cancelled,You only,',
      "2026-10-03,cook,9500.00,9500.00,cash,done,Both,5",
      "",
    ]);
    expect(workTotals(jobs)).toEqual({ jobs: 2, earned_paise: 950_000, rated: 1 });
  });

  it("is read page by page, and keeps only the jobs where the owner was the worker", async () => {
    const api = new FakeRecords();
    const next = "eng_01J00000000000000000000009" as EngagementId;
    api.pages = [{ jobs: [exported({})], next }, { jobs: [exported({ role: "requester" }), exported({ stars: 4 })] }];
    const jobs = await myWorkRecord(api);
    expect(jobs.map((j) => j.stars)).toEqual([undefined, 4]);
    expect(api.asked).toEqual([{ limit: 200 }, { limit: 200, after: next }]);
  });
});
