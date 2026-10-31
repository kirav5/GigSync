import { describe, expect, it } from "vitest";
import {
  AGREE_PREFIX,
  agreeBytes,
  ConsentAccept,
  EarningsQuery,
  JobRecordSubmit,
  JobStatusChange,
  JobSubmitState,
  MyBoardProfile,
  PaymentReport,
  RecordsPage,
  StarsReport,
} from "../src/index.js";

const submit = {
  engagement: "eng_01J0000000000000000000AAAA",
  counterpart: "usr_01J0000000000000000000BBBB",
  role: "provider",
  work: { trade: "painter", scope: { rooms: "bhk2", labour_only: "yes" } },
  terms: { when: { day: "2026-11-02", window: "morning" }, materials: "household", coats: 2 },
  price_paise: 900000,
  terms_hash: "a".repeat(64),
  sig: "c2ln",
};

describe("job records on the server", () => {
  it("takes a job's structured fields and the sender's signature", () => {
    expect(JobRecordSubmit.safeParse(submit).success).toBe(true);
    expect(JobRecordSubmit.parse({ ...submit, terms: undefined }).terms).toEqual({});
  });

  it("refuses any key outside the allowlist, so no words or contact details get in", () => {
    expect(JobRecordSubmit.safeParse({ ...submit, scope_text: "3rd floor, near temple" }).success).toBe(false);
    const work = { trade: "painter", scope: { rooms: "bhk2", labour_only: "yes", note: "call 98450…" } };
    expect(JobRecordSubmit.safeParse({ ...submit, work }).success).toBe(false);
    const terms = { when: { day: "2026-11-02", window: "morning", address: "x" } };
    expect(JobRecordSubmit.safeParse({ ...submit, terms }).success).toBe(false);
  });

  it("takes the job's pilot area as a slug, never an address (ADR 0039 §1)", () => {
    expect(JobRecordSubmit.parse({ ...submit, area: "jayanagar" }).area).toBe("jayanagar");
    expect(JobRecordSubmit.safeParse({ ...submit, area: "4th Block, Jayanagar" }).success).toBe(false);
  });

  it("refuses a scope value or a term the trade does not have", () => {
    const cook = { trade: "cook", scope: { rooms: "bhk2", labour_only: "yes" } };
    expect(JobRecordSubmit.safeParse({ ...submit, work: cook }).success).toBe(false);
    const maid = { trade: "maid", scope: { rooms: "bhk2", frequency: "daily" } };
    expect(JobRecordSubmit.safeParse({ ...submit, work: maid }).success).toBe(false); // coats are not a maid's term
    expect(JobRecordSubmit.safeParse({ ...submit, work: maid, terms: { hours: 3 } }).success).toBe(true);
  });

  it("takes a payment without a UPI reference, stars one to five, done or cancelled", () => {
    const pay = {
      payment: "pay_01J0000000000000000000AAAA",
      amount_paise: 900000,
      paid_on: "2026-11-02",
      method: "upi",
    };
    expect(PaymentReport.safeParse(pay).success).toBe(true);
    expect(PaymentReport.safeParse({ ...pay, utr: "123456789012" }).success).toBe(false);
    expect(PaymentReport.safeParse({ ...pay, paid_on: "2 Nov" }).success).toBe(false);
    expect(StarsReport.safeParse({ stars: 5 }).success).toBe(true);
    expect(StarsReport.safeParse({ stars: 6 }).success).toBe(false);
    expect(StarsReport.safeParse({ stars: 4, text: "good" }).success).toBe(false);
    expect(JobStatusChange.safeParse({ status: "done" }).success).toBe(true);
    expect(JobStatusChange.safeParse({ status: "agreed" }).success).toBe(false);
  });

  it("names a one-sided job as its own state", () => {
    expect(JobSubmitState.options).toEqual(["pending", "one_sided", "stored", "mismatch"]);
  });

  it("signs the agree prefix and the hash", () => {
    expect(new TextDecoder().decode(agreeBytes("ab"))).toBe(`${AGREE_PREFIX}ab`);
  });

  it("pages the export, names a notice, bounds analytics, and gives the owner their switch", () => {
    expect(RecordsPage.parse({})).toMatchObject({ limit: 100 });
    expect(RecordsPage.safeParse({ limit: "1000" }).success).toBe(false);
    expect(ConsentAccept.safeParse({ notice_version: "" }).success).toBe(false);
    expect(EarningsQuery.safeParse({ from: "2026-01", to: "2026-12" }).success).toBe(true);
    expect(EarningsQuery.safeParse({ from: "2026-12", to: "2026-01" }).success).toBe(false);
    expect(EarningsQuery.safeParse({ from: "2026-13", to: "2026-12" }).success).toBe(false);
    expect(EarningsQuery.safeParse({ from: "2024-01", to: "2025-12" }).success).toBe(true);
    expect(EarningsQuery.safeParse({ from: "2024-01", to: "2026-01" }).success).toBe(false);
    const card = { display_name: "R", trades: ["cook"], area: { lat: 1, lon: 1 }, area_name: "A", rate_paise: 100 };
    expect(MyBoardProfile.safeParse(card).success).toBe(false);
    expect(MyBoardProfile.safeParse({ ...card, show_record: true }).success).toBe(true);
  });
});
