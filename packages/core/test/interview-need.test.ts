import { type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  chooseNeedDate,
  DriverPick,
  draftDetails,
  EVERY_DAY,
  hearNeed,
  NeedPick,
  NeedSlot,
  type NeedState,
  needPrompt,
  needToSend,
  needWords,
  resolveDay,
  searchedNeed,
  searchFailed,
  startNeed,
} from "../src/index.js";

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] },
  { key: "hsr_layout", names: ["HSR Layout", "एचएसआर लेआउट", "HSR"] },
];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" });
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);
const run = (s: NeedState, answers: readonly string[]) => answers.reduce((at, a) => hearNeed(at, a), s);
const tap = (s: NeedState, values: readonly string[]) => values.reduce((at, v) => chooseNeed(at, v), s);

describe("the need interview", () => {
  it("opens on the need in the owner's own words, with trade chips", () => {
    const first = startNeed(config("en"));
    expect(keys(first)).toEqual(["need.start"]);
    expect(needPrompt(first).choices?.map((c) => c.value)).toEqual(Trade.options);
  });

  it("asks only what one sentence left out", () => {
    const asked = hearNeed(
      startNeed(config("en")),
      "bedroom fan not working, need an electrician tomorrow morning, up to 700",
    );
    expect(asked.slot).toBe(NeedSlot.area);
    expect(keys(asked)).toEqual(["need.ask.area"]);
    // The fan is read from the words; how many points is the price question left (ADR 0041), and "don't know" ends it.
    const s = hearNeed(asked, "HSR");
    expect(s.slot).toBe(NeedSlot.driver);
    expect(keys(s)).toEqual(["driver.ask.points.electrician"]);
    const atConfirm = hearNeed(s, "don't know");
    expect(atConfirm.slot).toBe(NeedSlot.confirm);
    expect(atConfirm.draft).toMatchObject({
      trade: T.electrician,
      area: "hsr_layout",
      day: "tomorrow",
      time: "morning",
    });
    expect(atConfirm.draft.budget_paise).toBe(70_000);
    expect(atConfirm.draft.detail).toBe("bedroom fan not working, need an electrician tomorrow morning");
    const lines = needPrompt(atConfirm).lines;
    expect(lines.map((l) => l.key)).toEqual([
      "need.summary",
      "need.summary_time",
      "need.summary_words",
      "need.summary_budget",
      "need.confirm",
    ]);
    // The budget is shown but never read aloud.
    expect(lines.find((l) => l.key === "need.summary_budget")?.silent).toBe(true);
  });

  it("asks the trade's first question when the problem was not said", () => {
    const s = hearNeed(startNeed(config("en")), "I need an electrician");
    expect(keys(s)).toEqual(["question.problem"]);
    expect(hearNeed(s, "skip").draft.detail).toBeNull();
    expect(hearNeed(s, "the geyser trips").draft.detail).toBe("the geyser trips");
  });

  it("defaults monthly work to every day and asks the budget with the city's band", () => {
    const s = run(startNeed(config("hi")), ["खाना बनाने वाली चाहिए", "4 लोग", "कोरमंगला", "पता नहीं"]);
    expect(s.draft.day).toBe(EVERY_DAY);
    expect(s.slot).toBe(NeedSlot.budget);
    const p = needPrompt(s);
    expect(p.lines.map((l) => l.key)).toEqual(["need.ask.budget", "need.band_month"]);
    expect(p.secret).toBe(true);
    expect(p.numeric).toBe(true);
    const typed = hearNeed(s, "नौ हज़ार");
    expect(typed.draft.budget_paise).toBe(900_000);
    // Typed, the readback stays quiet; said aloud, it is read back.
    expect(typed.notes[0]?.silent).toBe(true);
    expect(hearNeed(s, "नौ हज़ार", true).notes[0]?.silent).toBeUndefined();
  });

  it("runs on taps alone", () => {
    let s = tap(startNeed(config("hi")), [T.electrician, "skip", "koramangala", DriverPick.dontKnow, "tomorrow"]);
    expect(s.slot).toBe(NeedSlot.budget);
    s = hearNeed(s, "800");
    expect(s.slot).toBe(NeedSlot.confirm);
    expect(needWords(s.draft, "hi")).toBe("इलेक्ट्रीशियन");
    expect(tap(s, ["yes"]).slot).toBe(NeedSlot.done);
  });

  it("asks again, keeping what the answer did give", () => {
    const s = run(startNeed(config("en")), ["electrician", "fan broken"]);
    const again = hearNeed(s, "tomorrow");
    expect(again.slot).toBe(NeedSlot.area);
    expect(keys(again)).toEqual(["need.again", "need.ask.area"]);
    expect(run(again, ["Koramangala", "don't know"]).slot).toBe(NeedSlot.budget);
    expect(keys(hearNeed(run(again, ["Koramangala", "don't know"]), "lots"))).toEqual([
      "need.again_budget",
      "need.ask.budget",
    ]);
  });

  it("takes a date from the calendar, never a past one", () => {
    const s = run(startNeed(config("en")), ["painter", "300 sq ft", "HSR", "don't know"]);
    expect(s.slot).toBe(NeedSlot.when);
    expect(chooseNeed(s, NeedPick.date)).toBe(s);
    expect(chooseNeedDate(s, "2026-10-01")).toBe(s);
    expect(chooseNeedDate(s, "2026-11-05").draft.day).toBe("2026-11-05");
  });
});

describe("the readback", () => {
  const atConfirm = run(startNeed(config("en")), ["plumber, tap leaking, HSR, today, up to 600", "don't know"]);

  it("searches on yes", () => {
    expect(atConfirm.slot).toBe(NeedSlot.confirm);
    expect(hearNeed(atConfirm, "yes").slot).toBe(NeedSlot.done);
  });

  it("asks what to change on no, and a field word jumps to it", () => {
    const changing = hearNeed(atConfirm, "no");
    expect(keys(changing)).toEqual(["need.what_change"]);
    const toArea = hearNeed(changing, "the area");
    expect(toArea.slot).toBe(NeedSlot.area);
    expect(hearNeed(toArea, "Koramangala").slot).toBe(NeedSlot.confirm);
    expect(hearNeed(atConfirm, "change the budget").slot).toBe(NeedSlot.budget);
    expect(chooseNeed(changing, "when").slot).toBe(NeedSlot.when);
  });

  it("takes a correction said at the readback", () => {
    const s = hearNeed(atConfirm, "make it tomorrow in Koramangala");
    expect(s.slot).toBe(NeedSlot.confirm);
    expect(s.draft).toMatchObject({ day: "tomorrow", area: "koramangala" });
  });

  it("asks the new trade's question when the trade changes", () => {
    const s = hearNeed(chooseNeed(hearNeed(atConfirm, "no"), "trade"), "a maid instead");
    expect(s.draft.trade).toBe(T.maid);
    expect(keys(s)).toEqual(["question.rooms"]);
  });

  it("looks further when nobody is found, or changes something", () => {
    const done = hearNeed(atConfirm, "yes");
    const nobody = searchedNeed(done, 0);
    expect(needPrompt(nobody).choices?.map((c) => c.value)).toEqual(["10", "25", NeedPick.change]);
    expect(chooseNeed(nobody, "10")).toMatchObject({ slot: NeedSlot.done, radius_km: 10 });
    expect(hearNeed(nobody, "yes")).toMatchObject({ slot: NeedSlot.done, radius_km: 10 });
    expect(chooseNeed(nobody, NeedPick.change)).toMatchObject({ slot: NeedSlot.confirm, changing: true });
    expect(searchedNeed(done, 2).slot).toBe(NeedSlot.found);
    const failed = searchFailed(done, { key: "net.no_internet" });
    expect(keys(failed)[0]).toBe("net.no_internet");
    expect(hearNeed(failed, "yes").slot).toBe(NeedSlot.done);
  });
});

describe("the request", () => {
  it("is what the form sends", () => {
    const s = run(startNeed(config("en")), ["electrician, switch sparking, HSR, tomorrow 10 am, budget 800"]);
    const need = needToSend({
      trade: T.electrician,
      need: needWords(s.draft, "en"),
      day: "2026-10-30",
      label: "30/10/2026",
      time: s.draft.time,
      details: draftDetails(s.draft),
      budget_paise: s.draft.budget_paise ?? 0,
      area: { lat: 12.9, lon: 77.6 },
    });
    expect(need).toEqual({
      trade: T.electrician,
      need: "electrician, switch sparking, HSR, tomorrow 10 am",
      when: "30/10/2026 10 am",
      area: { lat: 12.9, lon: 77.6 },
      details: { problem: "electrician, switch sparking, HSR, tomorrow 10 am", day: "2026-10-30", time: "10 am" },
      budget: { opening_paise: 56_000, limit_paise: 80_000 },
    });
  });

  it("resolves day words on the phone's calendar", () => {
    const lateNightUtc = new Date("2026-10-29T20:00:00Z");
    expect(resolveDay("today", lateNightUtc, 330)).toBe("2026-10-30");
    expect(resolveDay("tomorrow", lateNightUtc, 330)).toBe("2026-10-31");
    expect(resolveDay(EVERY_DAY, lateNightUtc, 330)).toBe(EVERY_DAY);
  });
});
