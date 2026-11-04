import { type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ANY_TIME,
  ANY_TIME_PICK,
  CITY_RATES,
  chooseNeed,
  chooseNeedDate,
  DriverPick,
  draftDetails,
  EVERY_DAY,
  FIRST_HOUR,
  hearNeed,
  hourOf,
  LAST_HOUR,
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
  windowOf,
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
  it("opens on the need in the owner's own words, and shows trade chips only when the words named no work", () => {
    const first = startNeed(config("en"));
    expect(keys(first)).toEqual(["need.start"]);
    // ADR 0051: no grid of trades before the owner has said anything, only a way to it; the hints still help the
    // recognizer. The grid comes on that tap, or once the words named no work.
    expect(needPrompt(first).choices?.map((c) => c.value)).toEqual([NeedPick.list]);
    expect(needPrompt(first).hints).toHaveLength(Trade.options.length);
    expect(needPrompt(chooseNeed(first, NeedPick.list)).choices?.map((c) => c.value)).toEqual(Trade.options);
    const unclear = hearNeed(first, "hello there");
    expect(needPrompt(unclear).choices?.map((c) => c.value)).toEqual(Trade.options);
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
    // "Morning" alone is no start hour (ADR 0053 §1): the hour is asked, among the morning's hours only.
    const hour = hearNeed(s, "don't know");
    expect(hour.slot).toBe(NeedSlot.when);
    expect(keys(hour)).toEqual(["need.ask.hour"]);
    const chips = needPrompt(hour).choices?.map((c) => c.value) ?? [];
    expect(chips).toEqual(["at:7", "at:8", "at:9", "at:10", "at:11", "any_time"]);
    const atConfirm = hearNeed(hour, "10 am");
    expect(atConfirm.slot).toBe(NeedSlot.confirm);
    expect(atConfirm.draft).toMatchObject({
      trade: T.electrician,
      area: "hsr_layout",
      day: "tomorrow",
    });
    expect(hourOf(atConfirm.draft.time)).toBe(10);
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
    const s = run(startNeed(config("hi")), [
      "खाना बनाने वाली चाहिए",
      "4 लोग",
      "हर महीने",
      "कोरमंगला",
      "पता नहीं",
      "सुबह 7 बजे",
    ]);
    expect(s.draft.day).toBe(EVERY_DAY);
    expect(s.slot).toBe(NeedSlot.budget);
    const p = needPrompt(s);
    expect(p.lines.map((l) => l.key)).toEqual(["need.ask.budget", "need.budget_per.month", "need.band_month"]);
    expect(p.secret).toBe(true);
    expect(p.numeric).toBe(true);
    const typed = hearNeed(s, "नौ हज़ार");
    expect(typed.draft.budget_paise).toBe(900_000);
    // Typed, the readback stays quiet; said aloud, it is read back.
    expect(typed.notes[0]?.silent).toBe(true);
    expect(hearNeed(s, "नौ हज़ार", true).notes[0]?.silent).toBeUndefined();
  });

  it("never sends a bare count as the job's words: a cook asked for by name for 4 people reads as Cook", () => {
    expect(needWords({ trade: T.cook, detail: "4" }, "en")).toBe("Cook");
    expect(needWords({ trade: T.cook, detail: "४" }, "hi")).toBe("कुक");
    expect(needWords({ trade: T.plumber, detail: "kitchen tap leaking" }, "en")).toBe("kitchen tap leaking");
  });

  it("runs on taps alone", () => {
    let s = tap(startNeed(config("hi")), [
      T.electrician,
      "skip",
      "koramangala",
      DriverPick.dontKnow,
      "tomorrow",
      ANY_TIME_PICK,
    ]);
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
    expect(run(again, ["Koramangala", "don't know", "10 am"]).slot).toBe(NeedSlot.budget);
    expect(keys(hearNeed(run(again, ["Koramangala", "don't know", "10 am"]), "lots"))).toEqual([
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
  const atConfirm = run(startNeed(config("en")), [
    "plumber, tap leaking, HSR, today, up to 600",
    "don't know",
    "10 am",
  ]);

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

describe("the hour, once the day is known", () => {
  const at = (hour?: number) =>
    run(startNeed({ ...config("en"), ...(hour === undefined ? {} : { hour }) }), [
      "plumber, tap leaking, HSR",
      "don't know",
    ]);

  it("asks what time, with a chip for each hour and Any time, and reads the window from the hour picked", () => {
    const s = chooseNeed(at(), "tomorrow");
    expect(s.slot).toBe(NeedSlot.when);
    expect(keys(s)).toEqual(["need.ask.hour"]);
    const values = needPrompt(s).choices?.map((c) => c.value) ?? [];
    expect(values.at(0)).toBe(`at:${FIRST_HOUR}`);
    expect(values.at(-2)).toBe(`at:${LAST_HOUR}`);
    expect(values.at(-1)).toBe(ANY_TIME_PICK);
    const two = chooseNeed(s, "at:14");
    expect(two.draft.time).toBe("2 pm");
    expect(windowOf(two.draft.time)).toBe("afternoon");
    expect(chooseNeed(s, ANY_TIME_PICK).draft.time).toBe(ANY_TIME);
    expect(chooseNeed(s, "at:3")).toBe(s);
  });

  it("offers only hours still ahead today", () => {
    const s = chooseNeed(at(15), "today");
    expect(needPrompt(s).choices?.[0]?.value).toBe("at:16");
    expect(chooseNeed(s, "at:9")).toBe(s);
    expect(needPrompt(chooseNeed(at(15), "tomorrow")).choices?.[0]?.value).toBe(`at:${FIRST_HOUR}`);
  });

  it("reads the window from an hour in Hindi or Kannada words too", () => {
    const hi = { ...config("hi") };
    const kn = { ...config("kn") };
    const hiAt = (h: string) =>
      chooseNeed(chooseNeed(run(startNeed(hi), ["प्लंबर, नल टपक रहा है, HSR", "पता नहीं"]), "tomorrow"), h);
    const knAt = (h: string) =>
      chooseNeed(chooseNeed(run(startNeed(kn), ["ಪ್ಲಂಬರ್, ನಲ್ಲಿ ಸೋರುತ್ತಿದೆ, HSR", "ಗೊತ್ತಿಲ್ಲ"]), "tomorrow"), h);
    expect(windowOf(hiAt("at:8").draft.time)).toBe("morning");
    expect(windowOf(hiAt("at:14").draft.time)).toBe("afternoon");
    expect(windowOf(hiAt("at:18").draft.time)).toBe("evening");
    expect(windowOf(knAt("at:8").draft.time)).toBe("morning");
    expect(windowOf(knAt("at:14").draft.time)).toBe("afternoon");
    expect(windowOf(knAt("at:18").draft.time)).toBe("evening");
  });
});
