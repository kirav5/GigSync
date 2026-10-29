import { MENTOR_LINK_TTL_MS, MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  daysLeft,
  isExpired,
  JobStore,
  MemoryStorage,
  matchQuery,
  mentorExpiry,
  mentorRecord,
  renewedExpiry,
  womenOnly,
} from "../src/index.js";
import { listingOf } from "../src/mentor/listing.js";
import { seedRecord } from "./mentor-phones.js";
import type { Phone } from "./phones.js";

const NOW = new Date("2026-10-29T10:00:00+05:30");
const MS_PER_DAY = 86_400_000;
const DAYS_IN_SIX_MONTHS = 183;

/** A record on a bare phone: `count` signed, finished jobs, the first begun `days` ago. */
async function recordOf(count: number, days: number) {
  const storage = new MemoryStorage();
  const p = { user: "usr_01J0000000000000000000WWWW", storage } as unknown as Phone;
  await seedRecord(p, count, days, NOW);
  return mentorRecord(await new JobStore(storage).jobs(), NOW);
}

describe("who may list as a mentor", () => {
  it("needs both the jobs and the months, counted on the phone", async () => {
    expect(await recordOf(MENTOR_MIN_JOBS, DAYS_IN_SIX_MONTHS)).toEqual({ jobs: 20, months: 6, eligible: true });
    expect((await recordOf(MENTOR_MIN_JOBS - 1, DAYS_IN_SIX_MONTHS)).eligible).toBe(false);
    const young = await recordOf(MENTOR_MIN_JOBS + 5, 150);
    expect(young.months).toBeLessThan(MENTOR_MIN_MONTHS);
    expect(young.eligible).toBe(false);
  });

  it("counts only finished work both sides signed on the same terms", async () => {
    const storage = new MemoryStorage();
    const p = { user: "usr_01J0000000000000000000WWWW", storage } as unknown as Phone;
    await seedRecord(p, MENTOR_MIN_JOBS, 300, NOW);
    const store = new JobStore(storage);
    const [first, second, third] = await store.jobs();
    if (!first || !second || !third) throw new Error("seed failed");
    await store.saveJob({ ...first, theirs: undefined });
    await store.saveJob({ ...second, engagement: { ...second.engagement, status: "cancelled" } });
    await store.saveJob({ ...third, engagement: { ...third.engagement, role: "requester" } });
    const record = mentorRecord(await store.jobs(), NOW);
    expect(record.jobs).toBe(MENTOR_MIN_JOBS - 3);
    expect(record.eligible).toBe(false);
  });

  it("a phone with no jobs counts nothing", () => {
    expect(mentorRecord([], NOW)).toEqual({ jobs: 0, months: 0, eligible: false });
  });
});

describe("mentor link expiry", () => {
  it("ends 30 days after it opens; a link with no end date (an older in-person link) never ends", () => {
    const end = mentorExpiry(NOW);
    expect(Date.parse(end) - NOW.getTime()).toBe(MENTOR_LINK_TTL_MS);
    expect(daysLeft(end, NOW)).toBe(30);
    expect(isExpired({ expires_at: end }, NOW)).toBe(false);
    expect(isExpired({ expires_at: end }, new Date(Date.parse(end)))).toBe(true);
    expect(isExpired({}, new Date(NOW.getTime() + 1000 * MS_PER_DAY))).toBe(false);
  });

  it("a renewal moves the end forward only, and never past a full term from now", () => {
    const end = mentorExpiry(NOW);
    const later = new Date(NOW.getTime() + 10 * MS_PER_DAY);
    expect(renewedExpiry(end, mentorExpiry(later), later)).toBe(mentorExpiry(later));
    expect(renewedExpiry(end, NOW.toISOString(), later)).toBe(end);
    const far = new Date(NOW.getTime() + 400 * MS_PER_DAY).toISOString();
    expect(renewedExpiry(end, far, later)).toBe(mentorExpiry(later));
  });
});

describe("women-only, both ways round", () => {
  const filters = { city: "bengaluru", trade: "cook", lang: "hi" } as const;

  it("is on by default for a newcomer who said she is a woman, and she may switch it off", () => {
    expect(womenOnly({ woman: true })).toBe(true);
    expect(matchQuery({ woman: true, women_only: true }, filters)).toMatchObject({ women_only: true, woman: true });
    expect(matchQuery({ woman: true, women_only: false }, filters)).toMatchObject({ women_only: false, woman: true });
    expect(matchQuery({ woman: true }, { ...filters, women_only: false })).toMatchObject({ women_only: false });
  });

  it("is off for anyone else, who may still ask for women mentors, but never sees women-only mentors", () => {
    expect(matchQuery({}, filters)).toMatchObject({ women_only: false, woman: false });
    expect(matchQuery({ woman: false }, { ...filters, women_only: true })).toMatchObject({
      women_only: true,
      woman: false,
    });
  });

  it("a mentor's 'only women newcomers' counts only when she said she is a woman", () => {
    const record = { jobs: 24, months: 8, eligible: true };
    const choices = {
      first_name: "Lata",
      city: "bengaluru",
      area: "Koramangala",
      trades: ["cook"],
      languages: ["hi"],
      woman: false,
      women_only_newcomers: true,
      slots: 2,
    } as const;
    expect(listingOf(choices, record, 0)).toMatchObject({ woman: false, women_only_newcomers: false, open_slots: 2 });
    expect(listingOf({ ...choices, woman: true }, record, 1)).toMatchObject({
      women_only_newcomers: true,
      open_slots: 1,
    });
    expect(listingOf(choices, record, 5).open_slots).toBe(0);
  });
});
