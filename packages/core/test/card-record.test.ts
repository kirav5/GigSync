import {
  type Agree,
  type EngagementId,
  type EngagementStatus,
  MIN_RATED,
  type OfferId,
  type Role,
  type UserId,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type CardRecord,
  cardRecord,
  type JobRecord,
  JobStore,
  keepPublishedRecord,
  MemoryStorage,
  myCardRecord,
  ratingShown,
  recordDue,
  sameRecord,
  setShowsRecord,
  shownRecord,
  showsRecord,
  workerRecord,
} from "../src/index.js";

const ME = "usr_01J0000000000000000000WWWW" as UserId;
const ASHA = "usr_01J0000000000000000000AAAA" as UserId;
const BINA = "usr_01J0000000000000000000BBBB" as UserId;
const CHITRA = "usr_01J0000000000000000000CCCC" as UserId;

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

interface JobOpts {
  household?: UserId;
  status?: EngagementStatus;
  role?: Role;
  stars?: number;
  /** false: the household never signed. */
  signed?: boolean;
}

/** A job on the worker's phone: by default finished, both signed, unrated. */
function job(opts: JobOpts = {}): JobRecord {
  const id = `eng_${nextId()}` as EngagementId;
  const household = opts.household ?? ASHA;
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${nextId()}` as OfferId,
      worker: ME,
      consumer: household,
      trade: "cook",
      scope: "Cooking",
      slot: "mornings",
      price_paise: 1_100_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  return {
    engagement: {
      id,
      group: id,
      role: opts.role ?? "provider",
      counterpart: household,
      status: opts.status ?? "closed",
      brief: { text: "Cooking", topic: "cook", shared: {} },
      created_at: "2026-10-01T09:00:00+05:30",
      updated_at: "2026-10-02T09:00:00+05:30",
    },
    request: {
      trade: "cook",
      need: "Cooking",
      when: "mornings",
      area: { lat: 12.93, lon: 77.58 },
      details: {},
      lang: "en",
    },
    offers: [],
    offers_made: 1,
    asked: false,
    mine: agree,
    ...(opts.signed === false ? {} : { theirs: agree }),
    ...(opts.stars === undefined ? {} : { review: { stars: opts.stars, text: "" } }),
  };
}

describe("the worker's record on their card", () => {
  it("is all zeros, with no average, before any work", () => {
    expect(workerRecord([])).toEqual({ jobs: 0, rated: 0, came_back: 0 });
  });

  it("counts finished work both signed, the households' stars to one decimal, and households who came back", () => {
    const record = workerRecord([
      job({ household: ASHA, stars: 5 }),
      job({ household: ASHA, stars: 4, status: "delivered" }),
      job({ household: BINA, stars: 5 }),
      job({ household: CHITRA }),
    ]);
    expect(record).toEqual({ jobs: 4, rated: 3, average: 4.7, came_back: 1 });
    expect(ratingShown(record)).toBe(true);
  });

  it("leaves out work not both signed, not finished, cancelled, or done for this phone as the household", () => {
    const record = workerRecord([
      job({ signed: false, stars: 1 }),
      job({ status: "agreed", stars: 1 }),
      job({ status: "cancelled", stars: 1 }),
      job({ role: "consumer", stars: 1 }),
      job({ household: BINA, stars: 5 }),
    ]);
    expect(record).toEqual({ jobs: 1, rated: 1, average: 5, came_back: 0 });
  });

  it(`shows the average only once ${MIN_RATED} households rated`, () => {
    const two = workerRecord([job({ stars: 5 }), job({ household: BINA, stars: 5 })]);
    expect(two.average).toBe(5);
    expect(ratingShown(two)).toBe(false);
  });
});

describe("the record a card carries", () => {
  const record = { jobs: 4, rated: 3, average: 4.7, came_back: 1 };

  it("is all of it, or only that it is hidden", () => {
    expect(cardRecord(record, true)).toEqual({ record, show_record: true });
    expect(cardRecord(record, false)).toEqual({ show_record: false });
  });

  it("shows others the record only when its worker shows it", () => {
    expect(shownRecord(cardRecord(record, true))).toEqual(record);
    expect(shownRecord({ record })).toEqual(record);
    expect(shownRecord({ record, show_record: false })).toBeUndefined();
    expect(shownRecord({})).toBeUndefined();
  });

  it("is the same only when nothing on the board would change", () => {
    const shown: CardRecord = cardRecord(record, true);
    expect(sameRecord(shown, cardRecord({ ...record }, true))).toBe(true);
    expect(sameRecord(shown, cardRecord({ ...record, rated: 4 }, true))).toBe(false);
    expect(sameRecord(shown, { show_record: false })).toBe(false);
    expect(sameRecord({ show_record: false }, { show_record: false })).toBe(true);
    expect(sameRecord(undefined, shown)).toBe(false);
    expect(sameRecord(undefined, undefined)).toBe(true);
  });
});

describe("publishing the record with the card", () => {
  it("shows the record until the owner turns it off, and then publishes only that it is hidden", async () => {
    const storage = new MemoryStorage();
    await new JobStore(storage).saveJob(job({ stars: 5 }));
    expect(await showsRecord(storage)).toBe(true);
    expect(await myCardRecord(storage)).toEqual({
      record: { jobs: 1, rated: 1, average: 5, came_back: 0 },
      show_record: true,
    });
    await setShowsRecord(storage, false);
    expect(await myCardRecord(storage)).toEqual({ show_record: false });
  });

  it("is due when it changed since the board took it, after a new job or review, or the owner's choice", async () => {
    const storage = new MemoryStorage();
    const jobs = [job({ stars: 4 })];
    const first = await recordDue(storage, jobs);
    expect(first).toEqual({ record: { jobs: 1, rated: 1, average: 4, came_back: 0 }, show_record: true });
    if (first) await keepPublishedRecord(storage, first);
    expect(await recordDue(storage, jobs)).toBeUndefined();
    expect(await recordDue(storage, [...jobs, job({ household: BINA })])).toMatchObject({
      record: { jobs: 2, rated: 1 },
    });
    await setShowsRecord(storage, false);
    expect(await recordDue(storage, jobs)).toEqual({ show_record: false });
  });
});
