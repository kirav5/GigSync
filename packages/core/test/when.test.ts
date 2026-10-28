import { type JobRequest, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { dayOf, EVERY_DAY, isAfterDay, isMonthly, isOnDay, localDay, WhenDetail } from "../src/index.js";

const IST = 330;
const TODAY = "2026-10-29";
const T = Trade.enum;
const asked = (trade: Trade, day?: string): Pick<JobRequest, "trade" | "details"> => ({
  trade,
  details: day === undefined ? {} : { [WhenDetail.day]: day },
});

describe("the job's day", () => {
  it("is the phone's local calendar day, not UTC's", () => {
    expect(localDay(new Date("2026-10-29T18:29:59Z"), IST)).toBe("2026-10-29");
    expect(localDay(new Date("2026-10-29T18:30:00Z"), IST)).toBe("2026-10-30");
    expect(localDay(new Date("2026-10-29T03:00:00Z"), -300)).toBe("2026-10-28");
    expect(localDay(new Date("2026-12-31T20:00:00Z"), IST)).toBe("2027-01-01");
  });

  it("reads only an ISO date or every day from the details", () => {
    expect(dayOf(asked(T.electrician, TODAY))).toBe(TODAY);
    expect(dayOf(asked(T.electrician, EVERY_DAY))).toBe(EVERY_DAY);
    expect(dayOf(asked(T.electrician))).toBeUndefined();
    expect(dayOf(asked(T.electrician, "tomorrow"))).toBeUndefined();
    expect(dayOf(asked(T.electrician, "29/10/2026"))).toBeUndefined();
  });

  it("knows which trades are paid by the month", () => {
    expect(isMonthly(T.cook)).toBe(true);
    expect(isMonthly(T.maid)).toBe(true);
    expect(isMonthly(T.plumber)).toBe(false);
  });

  it("puts a one-off job on its own day only", () => {
    expect(isOnDay(asked(T.plumber, TODAY), TODAY)).toBe(true);
    expect(isOnDay(asked(T.plumber, "2026-10-30"), TODAY)).toBe(false);
    expect(isOnDay(asked(T.plumber, "2026-10-28"), TODAY)).toBe(false);
    expect(isOnDay(asked(T.plumber), TODAY)).toBe(false);
    expect(isOnDay(asked(T.plumber, EVERY_DAY), TODAY)).toBe(true);
  });

  it("puts monthly work on every day from its start, and on every day when no start was given", () => {
    expect(isOnDay(asked(T.cook), TODAY)).toBe(true);
    expect(isOnDay(asked(T.maid, "2026-10-01"), TODAY)).toBe(true);
    expect(isOnDay(asked(T.cook, TODAY), TODAY)).toBe(true);
    expect(isOnDay(asked(T.cook, "2026-11-02"), TODAY)).toBe(false);
  });

  it("files a later single day, or monthly work not started yet, as coming up", () => {
    expect(isAfterDay(asked(T.plumber, "2026-10-30"), TODAY)).toBe(true);
    expect(isAfterDay(asked(T.cook, "2026-11-02"), TODAY)).toBe(true);
    expect(isAfterDay(asked(T.plumber, TODAY), TODAY)).toBe(false);
    expect(isAfterDay(asked(T.plumber, "2026-10-28"), TODAY)).toBe(false);
    expect(isAfterDay(asked(T.plumber, EVERY_DAY), TODAY)).toBe(false);
    expect(isAfterDay(asked(T.plumber), TODAY)).toBe(false);
  });
});
