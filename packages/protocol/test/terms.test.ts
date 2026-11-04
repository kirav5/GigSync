import { describe, expect, it } from "vitest";
import {
  BODY,
  BoardQuery,
  canonicalJson,
  EVERY_DAY,
  fitTerms,
  JobRequest,
  JobTerms,
  MAX_COATS,
  Offer,
  TermKey,
  Terms,
  TermWhen,
  TRADE_TERMS,
  Trade,
  termsFit,
  WorkHours,
} from "../src/index.js";

const ULID = "01J0000000000000000000AAAA";
const offer = { offer_id: `off_${ULID}`, round: 1, price_paise: 50000, slot: "tomorrow", scope: "paint 2 rooms" };
const signed = {
  engagement: `eng_${ULID}`,
  offer_id: `off_${ULID}`,
  worker: `usr_${ULID}`,
  consumer: `usr_01J0000000000000000000BBBB`,
  trade: "painter",
  scope: "paint 2 rooms",
  slot: "tomorrow",
  price_paise: 900000,
};

describe("terms other than price", () => {
  it("accepts a day and window, materials, coats and hours within bounds", () => {
    const terms = { when: { day: "2026-11-02", window: "morning" }, materials: "household", coats: 2, hours: 8 };
    expect(Terms.parse(terms)).toEqual(terms);
    expect(Terms.parse({ when: { day: EVERY_DAY, window: "evening" } }).when?.day).toBe(EVERY_DAY);
  });

  it.each([
    ["a free-text day", { when: { day: "next tuesday", window: "morning" } }],
    ["an unknown window", { when: { day: "2026-11-02", window: "midnight" } }],
    ["too many coats", { coats: MAX_COATS + 1 }],
    ["a fraction of an hour", { hours: 7.5 }],
    ["someone else buying", { materials: "neighbour" }],
  ])("rejects %s", (_, terms) => {
    expect(Terms.safeParse(terms).success).toBe(false);
  });

  it("every trade negotiates when, and only a painter negotiates coats", () => {
    for (const trade of Trade.options) expect(TRADE_TERMS[trade]).toContain(TermKey.enum.when);
    const coats = Trade.options.filter((t) => TRADE_TERMS[t].includes(TermKey.enum.coats));
    expect(coats).toEqual([Trade.enum.painter]);
    expect(termsFit("electrician", { coats: 2 })).toBe(false);
    expect(fitTerms("electrician", { coats: 2, when: { day: "2026-11-02", window: "evening" } })).toEqual({
      when: { day: "2026-11-02", window: "evening" },
    });
  });

  it("offers and requests carry terms, and an older body without them still parses", () => {
    expect(Offer.parse({ ...offer, terms: { coats: 3 } }).terms).toEqual({ coats: 3 });
    expect(Offer.parse(offer).terms).toBeUndefined();
    const request = { trade: "painter", need: "Paint 2 rooms", when: "tomorrow", area: { lat: 12.9, lon: 77.6 } };
    expect(JobRequest.parse({ ...request, terms: { materials: "household" } }).terms).toEqual({
      materials: "household",
    });
    expect(BODY.quote.safeParse({ ...offer, terms: { coats: 9 } }).success).toBe(false);
  });

  it("signed terms refuse a term the trade does not negotiate", () => {
    expect(JobTerms.safeParse({ ...signed, terms: { coats: 2 } }).success).toBe(true);
    expect(JobTerms.safeParse({ ...signed, trade: "electrician", terms: { coats: 2 } }).success).toBe(false);
  });

  it("hashes signed terms without `terms` exactly as before terms existed", () => {
    const parsed = JobTerms.parse(signed);
    expect(canonicalJson(parsed)).toBe(canonicalJson(signed));
    expect(canonicalJson({ ...parsed, terms: undefined })).toBe(canonicalJson(signed));
  });

  it("an older phone's schema drops terms it does not know rather than failing", () => {
    const older = Offer.omit({ terms: true });
    expect(older.safeParse({ ...offer, terms: { coats: 2 } }).success).toBe(true);
  });
});

describe("start hours (ADR 0053 §1)", () => {
  it("takes a start hour on the clock beside the part of the day, and nothing past 23", () => {
    expect(TermWhen.safeParse({ day: "2026-11-10", window: "afternoon", hour: 14 }).success).toBe(true);
    expect(TermWhen.safeParse({ day: "2026-11-10", window: "afternoon", hour: 24 }).success).toBe(false);
    expect(TermWhen.safeParse({ day: "2026-11-10", window: "morning", hour: 9.5 }).success).toBe(false);
  });

  it("an older phone's schema drops the hour rather than failing, so it is sent only to phones that keep it", () => {
    const older = TermWhen.omit({ hour: true });
    expect(older.parse({ day: "2026-11-10", window: "evening", hour: 18 })).toEqual({
      day: "2026-11-10",
      window: "evening",
    });
  });

  it("takes a worker's hours from and to together, from before to, within the day", () => {
    const base = { days: [1, 2, 3], windows: ["morning", "afternoon"] };
    expect(WorkHours.safeParse({ ...base, from: 9, to: 18 }).success).toBe(true);
    expect(WorkHours.safeParse(base).success).toBe(true);
    expect(WorkHours.safeParse({ ...base, from: 9 }).success).toBe(false);
    expect(WorkHours.safeParse({ ...base, from: 18, to: 9 }).success).toBe(false);
    expect(WorkHours.safeParse({ ...base, from: 9, to: 25 }).success).toBe(false);
  });

  it("reads the board's hour from the query string", () => {
    const q = BoardQuery.parse({ trade: "plumber", lat: "12.9", lon: "77.6", hour: "14" });
    expect(q.hour).toBe(14);
    expect(BoardQuery.safeParse({ trade: "plumber", lat: "12.9", lon: "77.6", hour: "24" }).success).toBe(false);
  });
});
