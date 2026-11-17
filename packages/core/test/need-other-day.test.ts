import { describe, expect, it } from "vitest";
import { CITY_RATES, chooseNeed, hearNeed, NeedSlot, needPrompt, OTHER_DAY_PICK, startNeed } from "../src/index.js";

const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "एचएसआर लेआउट", "HSR"] }];
const config = { own: "en" as const, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" };
const keys = (s: ReturnType<typeof startNeed>) =>
  needPrompt(s)
    .lines.filter((l) => !l.aside)
    .map((l) => l.key);

describe("another day, at the hour question", () => {
  it("takes the day back to its own question, whatever the words had set", () => {
    // "Today" came with the words; the hour is asked for it.
    const atHour = ["plumber, tap leaking today, HSR", "don't know"].reduce(hearNeed, startNeed(config));
    expect(atHour.slot).toBe(NeedSlot.when);
    expect(keys(atHour)).toEqual(["need.ask.hour"]);
    expect(needPrompt(atHour).choices?.at(-1)?.value).toBe(OTHER_DAY_PICK);
    // Another day: the day is asked again, then the hour on the day picked.
    const again = chooseNeed(atHour, OTHER_DAY_PICK);
    expect(again.slot).toBe(NeedSlot.when);
    expect(again.draft.day).toBeUndefined();
    expect(again.draft.time).toBeUndefined();
    expect(keys(again)).toEqual(["need.ask.when"]);
    const tomorrow = chooseNeed(again, "tomorrow");
    expect(keys(tomorrow)).toEqual(["need.ask.hour"]);
  });
});
