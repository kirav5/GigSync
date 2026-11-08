import {
  Arrangement,
  arrangementsOf,
  fitsWork,
  hasArrangements,
  JobTrade,
  type Lang,
  oneOffWork,
  pricedDrivers,
  Trade,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  arrangementRates,
  CITY_RATES,
  cardArrangements,
  choose,
  EVERY_DAY,
  hear,
  isOnDay,
  jobFactor,
  mainOf,
  prompt,
  recurs,
  Slot,
  start,
} from "../src/index.js";
import { arrangementMandate } from "../src/job/arrangement-rules.js";

/** The job's nature (ADR 0051) on the worker's side: the card, their agent, the calendar and the price maths. */

const T = Trade.enum;
const A = Arrangement.enum;
const OTHER = JobTrade.enum.other;
const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const config = (own: Lang = "en") => ({ own, areas: AREAS, rates: CITY_RATES });
const RATE = { opening_paise: 50_000, limit_paise: 40_000 };

describe("each kind of work's arrangements", () => {
  it("are one visit for repairs and painting, never asked", () => {
    for (const trade of [T.electrician, T.plumber, T.carpenter, T.ac_technician, T.painter]) {
      expect(arrangementsOf(trade)).toEqual([A.visit]);
      expect(hasArrangements(trade)).toBe(false);
      expect(oneOffWork(trade)).toBe(true);
    }
  });

  it("are a meal, a week or a month for a cook; any way for house help, drivers and work of one's own", () => {
    expect(arrangementsOf(T.cook)).toEqual([A.visit, A.weekly, A.monthly]);
    expect(fitsWork(T.cook, A.hourly)).toBe(false);
    for (const work of [T.maid, T.driver, OTHER]) expect(arrangementsOf(work)).toEqual(Arrangement.options);
    expect(oneOffWork(T.cook)).toBe(false);
  });
});

describe("the card interview, by the job's nature", () => {
  it("offers a cook only what a cook takes, and ignores a tap of anything else", () => {
    const said = hear(start(config()), "cook");
    // "Do you also do any of these?" (ADR 0061) comes first; a no moves on.
    expect(said.slot).toBe(Slot.also);
    const s = hear(said, "no");
    expect(s.slot).toBe(Slot.arrangements);
    expect(prompt(s).choices?.map((c) => c.value)).toEqual([A.visit, A.weekly, A.monthly, "yes"]);
    expect(choose(s, A.hourly).draft.arrangements).toBeUndefined();
    const picked = choose(choose(s, A.visit), A.monthly);
    expect(picked.draft.arrangements).toEqual([A.visit, A.monthly]);
    // Said, only the ones a cook takes count.
    expect(hear(s, "by the hour and every month").draft.arrangements).toEqual([A.monthly]);
  });

  it("asks an electrician nothing about arrangements", () => {
    const said = hear(start(config()), "electrician");
    expect(said.slot).toBe(Slot.also);
    expect(hear(said, "no").slot).toBe(Slot.area);
    expect(cardArrangements({ trades: [T.electrician] })).toEqual([A.visit]);
  });

  it("asks a worker of their own skill, and the rate question follows the longest one they take", () => {
    const s = hear(hear(start(config()), "I am a nanny"), "by the hour and monthly");
    expect(s.draft.arrangements).toEqual([A.hourly, A.monthly]);
    expect(prompt(hear(s, "Koramangala")).lines[0]?.key).toBe("iv.ask.rate_month");
    expect(cardArrangements({ skills: [{ text: "Nanny", lang: "en" }] })).toEqual(Arrangement.options);
  });

  it("puts no arrangement on a skill card that names none, so it takes any, as before; a trade's stays monthly", () => {
    const own = { skills: [{ text: "Tailor", lang: "en" as const }], area: "koramangala", rate_paise: 60_000 };
    expect(mainOf(own)).toBeUndefined();
    expect(arrangementRates(own)).toEqual([]);
    const cook = { trades: [T.cook], area: "koramangala", rate_paise: 900_000 };
    expect(arrangementRates(cook)).toEqual([{ arrangement: A.monthly, rate_paise: 900_000 }]);
  });
});

describe("the worker's agent", () => {
  const request = (trade: JobTrade, arrangement: Arrangement) => ({ trade, details: { arrangement } });

  it("declines a cook's one meal when the card takes monthly work only", () => {
    expect(arrangementMandate({ rate: RATE }, request(T.cook, A.visit))).toBeUndefined();
    expect(arrangementMandate({ rate: RATE }, request(T.cook, A.monthly))).toEqual(RATE);
  });

  it("takes any arrangement for work of one's own when the card names none, as before", () => {
    expect(arrangementMandate({ rate: RATE }, request(OTHER, A.hourly))).toEqual(RATE);
  });

  it("uses the skill card's own rate for the arrangement asked, and declines one it does not take", () => {
    const hourly = { opening_paise: 20_000, limit_paise: 15_000 };
    const rules = { rate: RATE, arrangements: [{ arrangement: A.hourly, rate: hourly }] };
    expect(arrangementMandate(rules, request(OTHER, A.hourly))).toEqual(hourly);
    expect(arrangementMandate(rules, request(OTHER, A.weekly))).toBeUndefined();
  });
});

describe("when a cook's job is", () => {
  const meal = { trade: T.cook, details: { day: "2026-11-07", arrangement: A.visit } };
  const month = { trade: T.cook, details: { day: EVERY_DAY, arrangement: A.monthly } };

  it("is one day for one meal, and every day for a month", () => {
    expect(recurs(meal)).toBe(false);
    expect(isOnDay(meal, "2026-11-07")).toBe(true);
    expect(isOnDay(meal, "2026-11-08")).toBe(false);
    expect(recurs(month)).toBe(true);
    expect(recurs({ trade: T.cook, details: {} })).toBe(true);
    expect(recurs({ trade: T.electrician, details: {} })).toBe(false);
  });
});

describe("a cook's price, by arrangement", () => {
  it("prices one meal by how many eat, and a week by its days, meals and people", () => {
    expect(pricedDrivers(T.cook, A.visit)).toEqual(["people"]);
    expect(pricedDrivers(T.cook, A.weekly)).toEqual(["days_week", "meals", "people"]);
    const few = jobFactor(T.cook, { people: 2, meals: 2, days_week: 7 }, A.visit);
    const many = jobFactor(T.cook, { people: 8, meals: 2, days_week: 7 }, A.visit);
    expect(many).toBeGreaterThan(few);
    // A meal's price does not change with meals a day or days a week, which only a month or week has.
    expect(jobFactor(T.cook, { people: 4, meals: 3, days_week: 2 }, A.visit)).toBe(
      jobFactor(T.cook, { people: 4, meals: 1, days_week: 7 }, A.visit),
    );
  });
});
