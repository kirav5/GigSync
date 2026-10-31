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
import {
  ActivityTab,
  activityOf,
  countsOf,
  firstTab,
  groupJobs,
  type JobRecord,
  type OwnerTask,
  paidRecord,
  TaskKind,
  taskId,
} from "../src/index.js";

const ME = "usr_01J0000000000000000000WWWW" as UserId;
const OTHER = "usr_01J0000000000000000000CCCC" as UserId;
/** India: UTC+05:30. */
const IST = 330;
const DAY = "2026-10-29";
const NOW = new Date("2026-10-29T10:00:00+05:30");

/** What a restored job's record says the work was. */
const RESTORED_WORK = { trade: "electrician" as const, scope: {} };

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

interface JobOpts {
  status?: EngagementStatus;
  role?: Role;
  trade?: Trade;
  day?: string;
  /** false: never signed (a request still being talked over, or a question). */
  signed?: boolean;
}

/** A job on this phone; signed by both sides on the same terms unless `signed` is false. */
function job({ status = "agreed", role = "provider", trade = "electrician", day, signed = true }: JobOpts = {}) {
  const id = `eng_${nextId()}` as EngagementId;
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${nextId()}` as OfferId,
      worker: role === "provider" ? ME : OTHER,
      consumer: role === "provider" ? OTHER : ME,
      trade,
      scope: "Fan repair",
      slot: "tomorrow 10:00",
      price_paise: 65_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  const record: JobRecord = {
    engagement: {
      id,
      group: id,
      role,
      counterpart: OTHER,
      status,
      brief: { text: "Fan repair", topic: trade, shared: {} },
      created_at: `2026-10-01T09:00:${String(seq % 60).padStart(2, "0")}+05:30`,
      updated_at: "2026-10-20T09:00:00+05:30",
    },
    request: {
      trade,
      need: "Fan repair",
      when: "tomorrow",
      area: { lat: 12.97, lon: 77.64 },
      details: day ? { day } : {},
      lang: "en",
    },
    offers: [],
    offers_made: 1,
    asked: false,
    ...(signed ? { mine: agree, theirs: agree } : {}),
  };
  return record;
}

const task = (kind: TaskKind, j: JobRecord): OwnerTask => ({
  id: taskId(kind, j.engagement.id),
  kind,
  engagement: j.engagement.id,
  detail: {},
  created_at: NOW.toISOString(),
});

function pay(j: JobRecord, status: PaymentStatus, opts: { from?: UserId; amount?: number } = {}): Payment {
  const at = "2026-10-20T10:00:00+05:30";
  return {
    id: `pay_${nextId()}` as PaymentId,
    engagement: j.engagement.id,
    payee: j.engagement.role === "provider" ? ME : OTHER,
    payer: opts.from ?? (j.engagement.role === "provider" ? OTHER : ME),
    amount_paise: opts.amount ?? 65_000,
    method: "upi",
    status,
    note: "",
    requested_at: at,
    ...(status === "paid" || status === "confirmed" ? { paid_at: at } : {}),
    ...(status === "confirmed" ? { confirmed_at: at } : {}),
  };
}

const ids = (jobs: readonly JobRecord[]) => jobs.map((j) => j.engagement.id).sort();
const activity = (jobs: JobRecord[], tasks: OwnerTask[] = [], payments: Payment[] = []) =>
  activityOf(groupJobs({ jobs, tasks, payments, day: DAY }));

describe("Activity's tabs", () => {
  it("files decide under Awaiting you, talking under In talks, signed work under Agreed, and the rest under Records", () => {
    const toSign = job({ status: "confirming", signed: false });
    const quoting = job({ status: "negotiating", signed: false });
    const today = job({ day: DAY });
    const later = job({ day: "2026-11-03" });
    const noDay = job();
    const finished = job({ status: "closed" });
    const a = activity([toSign, quoting, today, later, noDay, finished], [task(TaskKind.signTerms, toSign)]);
    expect(ids(a.awaiting)).toEqual(ids([toSign]));
    expect(ids(a.talks)).toEqual(ids([quoting]));
    expect(ids(a.agreed.today)).toEqual(ids([today]));
    expect(ids(a.agreed.upcoming)).toEqual(ids([later]));
    expect(ids(a.agreed.other)).toEqual(ids([noDay]));
    expect(ids(a.records.done)).toEqual(ids([finished]));
    expect(countsOf(a)).toEqual({ awaiting: 1, talks: 1, agreed: 3, closed: 1 });
  });

  it("keeps delivered work whose payment is not confirmed under Agreed, and moves it to Records once it is", () => {
    const delivered = job({ status: "delivered" });
    const asked = pay(delivered, "requested");
    expect(ids(activity([delivered], [], [asked]).agreed.other)).toEqual(ids([delivered]));
    const confirmed = activity([delivered], [], [{ ...pay(delivered, "confirmed") }]);
    expect(confirmed.agreed.other).toEqual([]);
    expect(ids(confirmed.records.done)).toEqual(ids([delivered]));
  });

  it("keeps a household's paid delivery in Awaiting you while it still has to say whether the money went", () => {
    const delivered = job({ status: "delivered", role: "requester" });
    const a = activity([delivered], [task(TaskKind.confirmPayment, delivered)], [pay(delivered, "paid")]);
    expect(ids(a.awaiting)).toEqual(ids([delivered]));
  });

  it("keeps a monthly arrangement under Agreed while it runs, paid or not, and puts it in Records once it ended", () => {
    const running = job({ status: "delivered", trade: "cook", day: "2026-10-01" });
    const paid = activity([running], [], [pay(running, "confirmed")]);
    expect(ids(paid.agreed.today)).toEqual(ids([running]));
    expect(paid.records.done).toEqual([]);
    const ended = { ...running, engagement: { ...running.engagement, status: "closed" as const } };
    expect(ids(activity([ended]).records.done)).toEqual(ids([ended]));
  });

  it("puts cancelled, declined and expired jobs in Records' Not completed, and drops a question that just closed", () => {
    const cancelled = job({ status: "cancelled" });
    const declined = job({ status: "declined", signed: false });
    const expired = job({ status: "expired", signed: false });
    const question = job({ status: "closed", signed: false });
    const a = activity([cancelled, declined, expired, question]);
    expect(ids(a.records.notDone)).toEqual(ids([cancelled, declined, expired]));
    expect(a.records.done).toEqual([]);
    expect(countsOf(a).closed).toBe(3);
  });

  it("counts a restored job, which carries no signatures, as completed work", () => {
    const facts = { attested: true, agreed_at: "2026-10-01", price_paise: 65_000, work: RESTORED_WORK, payments: [] };
    const restored: JobRecord = { ...job({ status: "closed", signed: false }), restored: facts };
    expect(ids(activity([restored]).records.done)).toEqual(ids([restored]));
  });

  it("opens on Awaiting you whenever something waits, else on the first tab with anything", () => {
    const counts = { awaiting: 0, talks: 0, agreed: 0, closed: 4 };
    expect(firstTab(counts)).toBe(ActivityTab.awaiting);
    expect(firstTab({ ...counts, agreed: 2 })).toBe(ActivityTab.agreed);
    expect(firstTab({ ...counts, agreed: 2, talks: 1 })).toBe(ActivityTab.talks);
    expect(firstTab({ ...counts, agreed: 2, talks: 1, awaiting: 1 })).toBe(ActivityTab.awaiting);
    expect(countsOf(activity([]), 2).awaiting).toBe(2);
  });
});

describe("a household's Records", () => {
  it("lists each completed job once with what was paid, by month, and the total", () => {
    const fan = job({ status: "closed", role: "requester", day: "2026-10-12" });
    const tap = job({ status: "closed", role: "requester", day: "2026-09-30" });
    const payments = [
      pay(fan, "confirmed", { amount: 40_000 }),
      pay(fan, "paid", { amount: 25_000 }),
      pay(tap, "confirmed"),
      pay(tap, "requested", { amount: 99_000 }),
      pay(tap, "confirmed", { from: OTHER }),
    ];
    const record = paidRecord([tap, fan], payments, ME, NOW, IST);
    expect(record.months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    const [october, september] = record.months;
    expect(october?.rows.map((r) => [r.paid_paise, r.confirmed])).toEqual([[65_000, false]]);
    expect(september?.rows.map((r) => [r.paid_paise, r.confirmed])).toEqual([[65_000, true]]);
    expect(record.paid_paise).toBe(130_000);
  });
});
