import { type EngagementId, type IsoWeekday, type Terms, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  answerTerms,
  changedFromWants,
  counterOptions,
  DAYS_AHEAD,
  householdStance,
  type JobRecord,
  MAX_OPTIONS,
  termDetails,
  workerStance,
  workHoursOf,
} from "../src/index.js";
import { withTermDetails } from "../src/job/terms-flow.js";

const T = Trade.enum;
const DAY = "2026-11-02";
const morning = { day: DAY, window: "morning" } as const;
const afternoon = { day: DAY, window: "afternoon" } as const;

describe("the terms a worker's stance accepts and counters", () => {
  const afternoonsOnly = workerStance({ windows: ["afternoon"] }, [], DAY);

  it("keeps an acceptable proposal as it is", () => {
    const answer = answerTerms(T.painter, afternoonsOnly, { when: afternoon, coats: 3 });
    expect(answer).toMatchObject({ agreed: true, next: { when: afternoon, coats: 3 } });
  });

  it("counters a window they do not work with the closest one they do, the same day first", () => {
    const answer = answerTerms(T.painter, afternoonsOnly, { when: morning });
    expect(answer.agreed).toBe(false);
    expect(answer.next.when).toEqual(afternoon);
    expect(answer.options.when?.[1]).toEqual({ day: "2026-11-03", window: "afternoon" });
  });

  it("never offers a time already booked, and moves the day at most DAYS_AHEAD later", () => {
    const booked = workerStance({ windows: ["afternoon"] }, [afternoon], DAY);
    const options = counterOptions("when", morning, booked);
    expect(options).not.toContainEqual(afternoon);
    expect(options.length).toBeLessThanOrEqual(MAX_OPTIONS);
    for (const o of options) expect(Date.parse(o.day) - Date.parse(DAY)).toBeLessThanOrEqual(DAYS_AHEAD * 86_400_000);
  });

  it("is stuck, not agreeable, when every window it works near the asked day is booked", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
    const full = workerStance(
      { windows: ["afternoon"] },
      days.map((day) => ({ day, window: "afternoon" as const })),
    );
    const answer = answerTerms(T.painter, full, { when: morning });
    expect(answer).toMatchObject({ agreed: false, stuck: ["when"] });
  });

  it("a daily job booked in the morning blocks every morning", () => {
    const busy = workerStance(undefined, [{ day: "daily", window: "morning" }], DAY);
    expect(busy.accepts.when(morning)).toBe(false);
    expect(busy.accepts.when(afternoon)).toBe(true);
  });

  it("proposes their first free window when the household named none, and their materials", () => {
    const stance = workerStance({ windows: ["evening", "afternoon"], materials: "worker" }, [], DAY);
    const answer = answerTerms(T.painter, stance, { coats: 2 });
    expect(answer.next).toEqual({ when: { day: DAY, window: "evening" }, materials: "worker", coats: 2 });
    expect(answer.agreed).toBe(false);
  });

  it("caps the hours at their most, and ignores terms their trade does not negotiate", () => {
    const stance = workerStance({ max_hours: 8 }, []);
    expect(answerTerms(T.driver, stance, { hours: 10 }).next.hours).toBe(8);
    expect(answerTerms(T.electrician, stance, { hours: 10, coats: 3 })).toEqual({
      next: {},
      options: {},
      agreed: true,
      stuck: [],
    });
  });
});

describe("the household's stance", () => {
  const wants: Terms = { when: morning, materials: "household" };

  it("takes anything for a term its owner did not name, only their value for one they did", () => {
    const stance = householdStance(wants, []);
    expect(stance.accepts.coats(3)).toBe(true);
    expect(stance.accepts.when(afternoon)).toBe(false);
    expect(answerTerms(T.painter, stance, { when: afternoon, materials: "household" }).next.when).toEqual(morning);
  });

  it("is flexible within a day when its owner said any time is fine", () => {
    const stance = householdStance(wants, ["when"]);
    expect(stance.accepts.when(afternoon)).toBe(true);
    expect(stance.accepts.when({ day: "2026-11-05", window: "morning" })).toBe(false);
  });

  it("takes a value the worker proposes twice running: firm, for the owner to decide when signing", () => {
    const stance = householdStance(wants, [], { when: afternoon });
    expect(stance.accepts.when(afternoon)).toBe(true);
    expect(changedFromWants(wants, { when: afternoon, materials: "household" })).toEqual(["when"]);
    expect(changedFromWants(wants, { ...wants, coats: 2 })).toEqual([]);
  });
});

describe("terms that change the price do it through the scope", () => {
  it("materials, coats and hours become the details the estimate and the city band read", () => {
    expect(termDetails(T.painter, { materials: "worker", coats: 3 })).toEqual({ labour_only: "no", coats: "3" });
    expect(termDetails(T.carpenter, { materials: "worker" })).toEqual({});
    expect(termDetails(T.driver, { hours: 10 })).toEqual({ hours: "10" });
  });

  it("drops the worker's plan when a term changes the scope, so code plans it again", () => {
    const job = {
      engagement: { id: "eng_x" as EngagementId },
      request: { trade: T.painter, details: { rooms: "2", labour_only: "yes" } },
      mandate: { opening_paise: 2_000_000, limit_paise: 1_200_000 },
    } as unknown as JobRecord;
    const replanned = withTermDetails(job, { materials: "worker" });
    expect(replanned.mandate).toBeUndefined();
    expect(replanned.request.details).toEqual({ rooms: "2", labour_only: "no" });
    expect(withTermDetails(job, { materials: "household" })).toBe(job);
  });
});

describe("working days (ADR 0050)", () => {
  it("never finds a day off free, and shows the days and parts of the day on the card", () => {
    const weekdays = { days: [1, 2, 3, 4, 5] as IsoWeekday[], windows: ["morning" as const] };
    const stance = workerStance(weekdays, [], "2026-11-09");
    expect(stance.accepts.when({ day: "2026-11-09", window: "morning" })).toBe(true);
    expect(stance.accepts.when({ day: "2026-11-07", window: "morning" })).toBe(false);
    expect(stance.accepts.when({ day: "daily", window: "morning" })).toBe(true);
    expect(workHoursOf(weekdays)).toEqual(weekdays);
    expect(workHoursOf({ days: [6, 7] })).toEqual({ days: [6, 7], windows: ["morning", "afternoon", "evening"] });
    expect(workHoursOf({ materials: "worker" })).toBeUndefined();
  });
});
