import { termsHash } from "@gigsync/crypto";
import { type EngagementId, HOURS_PROTOCOL, Lang, OWNER_OFFERS_PROTOCOL, type Terms, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  atHour,
  type Clock,
  FIRST_HOUR,
  hourText,
  LAST_HOUR,
  type NewNeed,
  overlaps,
  settle,
  spanOf,
  type TermPrefs,
  type WorkerRules,
  whenPassed,
  whenText,
  workerStance,
  workHoursOf,
} from "../src/index.js";
import { hourOf } from "../src/interview/need-terms.js";
import { BENGALURU, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

/** ADR 0053 §1: a time is a day and a start hour, between phones that both understand hours. */

const T = Trade.enum;
const DAY = "2026-11-02";
/** The phones' clock: the morning of the day before (India), so every hour of the 2nd is ahead. */
const BEFORE: Clock = { now: () => new Date("2026-11-01T03:30:00Z") };

const kiran = (terms?: TermPrefs): WorkerRules => ({
  trades: [T.painter],
  rate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
  base: BENGALURU,
  radius_km: 10,
  ...(terms ? { terms } : {}),
});

const paintAt = (terms: Terms): NewNeed => ({
  trade: T.painter,
  need: "Paint my 2BHK",
  when: DAY,
  area: { lat: 12.975, lon: 77.645 },
  details: { rooms: "2", labour_only: "yes", day: DAY },
  budget: { opening_paise: 1_300_000, limit_paise: 1_900_000 },
  terms,
});

async function pair(rules: WorkerRules, home = HOURS_PROTOCOL, worker = HOURS_PROTOCOL) {
  const relay = new MemoryRelay();
  const priya = await phone(relay, PRIYA, { protocol: home, autoConfirm: true, clock: BEFORE });
  const ravi = await phone(relay, RAVI, { worker: rules, protocol: worker, autoConfirm: true, clock: BEFORE });
  return { priya, ravi, talk: () => settle([priya.device, ravi.device]) };
}

describe("reading and writing a start hour", () => {
  it("reads back every hour a chip offers, in each language, so the hour is never asked twice", () => {
    for (const lang of Lang.options)
      for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) expect([lang, hourOf(hourText(lang, h))]).toEqual([lang, h]);
  });

  it("reads none from a part of the day alone, or from nothing", () => {
    expect(hourOf("kal subah")).toBeUndefined();
    expect(hourOf("")).toBeUndefined();
    expect(hourOf("tomorrow 10 am")).toBe(10);
  });

  it("writes the hour instead of the part of the day", () => {
    expect(whenText(Lang.enum.en, atHour(DAY, 14))).toContain(hourText(Lang.enum.en, 14));
    expect(whenText(Lang.enum.en, { day: DAY, window: "morning" })).toMatch(/morning/i);
  });

  it("counts a start hour as passed once it has come, not when its part of the day ends", () => {
    const at = (iso: string) => new Date(iso);
    expect(whenPassed(atHour(DAY, 10), at(`${DAY}T04:29:00Z`))).toBe(false);
    expect(whenPassed(atHour(DAY, 10), at(`${DAY}T04:30:00Z`))).toBe(true);
    expect(whenPassed({ day: DAY, window: "morning" }, at(`${DAY}T04:30:00Z`))).toBe(false);
  });
});

describe("a worker's own hours", () => {
  const nineToSix: TermPrefs = { from: 9, to: 18 };

  it("go on the card with the parts of the day they touch, for older phones", () => {
    expect(workHoursOf({ ...nineToSix, days: [1, 2, 3] })).toEqual({
      days: [1, 2, 3],
      windows: ["morning", "afternoon", "evening"],
      from: 9,
      to: 18,
    });
    expect(workHoursOf({ from: 9, to: 12 })?.windows).toEqual(["morning"]);
  });

  it("take a start hour inside them, refuse one outside, and propose the first free one", () => {
    const stance = workerStance(nineToSix, [], DAY);
    expect(stance.accepts.when(atHour(DAY, 9))).toBe(true);
    expect(stance.accepts.when(atHour(DAY, 17))).toBe(true);
    expect(stance.accepts.when(atHour(DAY, 18))).toBe(false);
    expect(stance.accepts.when(atHour(DAY, 8))).toBe(false);
    expect(stance.wants.when).toEqual(atHour(DAY, 9));
  });

  it("clash by the hours a job takes: a 10 o'clock job of two hours blocks 11, not 12", () => {
    const busy = [spanOf(atHour(DAY, 10))];
    const stance = workerStance(nineToSix, busy, DAY);
    expect(stance.accepts.when(atHour(DAY, 11))).toBe(false);
    expect(stance.accepts.when(atHour(DAY, 12))).toBe(true);
    expect(stance.accepts.when(atHour(DAY, 9))).toBe(false);
    // A job of four hours a day from 10 holds until 2.
    const long = workerStance(nineToSix, [spanOf(atHour(DAY, 10), 4)], DAY);
    expect(long.accepts.when(atHour(DAY, 13))).toBe(false);
    expect(long.accepts.when(atHour(DAY, 14))).toBe(true);
  });
});

describe("two phones agreeing a start hour", () => {
  it("agree the hour itself when both understand hours, and sign it", async () => {
    const { priya, ravi, talk } = await pair(kiran({ from: 9, to: 18 }));
    const [job] = await priya.device.request(paintAt({ when: atHour(DAY, 14) }), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    expect(job?.request.terms?.when).toEqual(atHour(DAY, 14));
    await talk();
    const [hers, his] = [await priya.device.job(id), await ravi.device.job(id)];
    expect(hers.engagement.status).toBe("agreed");
    expect(hers.mine?.terms.terms?.when).toEqual(atHour(DAY, 14));
    expect(termsHash(hers.mine?.terms as never)).toBe(his.mine?.terms_hash);
  });

  it("send only the part of the day to a phone that does not understand hours, and still sign", async () => {
    const { priya, ravi, talk } = await pair(kiran(), HOURS_PROTOCOL, OWNER_OFFERS_PROTOCOL);
    const [job] = await priya.device.request(paintAt({ when: atHour(DAY, 14) }), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    expect(job?.request.terms?.when).toEqual({ day: DAY, window: "afternoon" });
    await talk();
    const [hers, his] = [await priya.device.job(id), await ravi.device.job(id)];
    expect(hers.engagement.status).toBe("agreed");
    expect(hers.mine?.terms.terms?.when).toEqual({ day: DAY, window: "afternoon" });
    expect(hers.mine?.terms_hash).toBe(his.mine?.terms_hash);
  });

  it("asks the household when the worker can only start at another hour", async () => {
    const { priya, ravi, talk } = await pair(kiran({ from: 9, to: 13 }));
    const [job] = await priya.device.request(paintAt({ when: atHour(DAY, 15) }), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    const ask = (await priya.device.tasks()).find((t) => t.engagement === id)?.detail as { when?: { hour?: number } };
    expect(ask?.when?.hour).toBeGreaterThanOrEqual(9);
    expect(ask?.when?.hour).toBeLessThan(13);
  });
});

describe("the review's cases (ADR 0053 §1–2)", () => {
  it("reads minutes said after a space when am, pm or a clock word follows", () => {
    expect(hourOf("10 30 am")).toBe(10);
    expect(hourOf("2 30 pm")).toBe(14);
    expect(hourOf("kal 10 30 baje")).toBe(10);
  });

  it("never gives a job without hours an hour, even when the worker's phone understands them", async () => {
    const { priya, ravi, talk } = await pair(kiran({ from: 9, to: 18 }), OWNER_OFFERS_PROTOCOL, HOURS_PROTOCOL);
    const [job] = await priya.device.request(paintAt({ when: { day: DAY, window: "morning" } }), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    const his = await ravi.device.job(id);
    for (const o of his.offers) expect(o.offer.terms?.when?.hour).toBeUndefined();
    expect((await priya.device.job(id)).mine?.terms_hash).toBe(his.mine?.terms_hash);
  });

  it("offers another time when a deal waiting for the worker's signature has passed, instead of keeping it", async () => {
    let at = BEFORE.now();
    const clock: Clock = { now: () => at };
    const relay = new MemoryRelay();
    const priya = await phone(relay, PRIYA, { protocol: HOURS_PROTOCOL, autoConfirm: true, clock });
    const ravi = await phone(relay, RAVI, {
      worker: kiran({ from: 9, to: 18 }),
      protocol: HOURS_PROTOCOL,
      autoConfirm: false,
      clock,
    });
    const need = {
      ...paintAt({ when: atHour(DAY, 10) }),
      budget: { opening_paise: 1_000_000, limit_paise: 1_500_000 },
    };
    const [job] = await priya.device.request(need, [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    await settle([priya.device, ravi.device]);
    // Whoever's agent said yes first, the deal ends up waiting for his signature.
    expect((await ravi.device.tasks()).map((t) => t.kind)).toEqual(["confirm_deal"]);
    // He did not sign before ten: at half past, that deal is gone and his agent offers his next free hour.
    at = new Date(`${DAY}T05:00:00Z`);
    await ravi.device.sync();
    expect(await ravi.device.tasks()).toEqual([]);
    const next = (await ravi.device.job(id)).offers.at(-1)?.offer.terms?.when;
    expect(next?.hour).toBe(11);
  });

  it("warns of a clash with a signed job by that job's own hours a day", () => {
    const fourHours = spanOf(atHour(DAY, 10), 4);
    expect(overlaps({ day: DAY, start_min: 13 * 60, end_min: 14 * 60 }, fourHours)).toBe(true);
    expect(overlaps({ day: DAY, start_min: 14 * 60, end_min: 15 * 60 }, fourHours)).toBe(false);
  });
});
