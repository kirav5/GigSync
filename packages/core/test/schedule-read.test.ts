import { EVERY_DAY, Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ChatIntent,
  ChatRole,
  keywordRoute,
  readSchedule,
  ScheduleAction,
  soundsLikeSchedule,
  timeIn,
} from "../src/index.js";

/** Tuesday 3 November 2026, 10:00 on the phone. */
const NOW = { day: "2026-11-03", minute: 600 };
const TOMORROW = "2026-11-04";
const SATURDAY = "2026-11-07";
const hours = (start: number, end: number) => ({ start_min: start * 60, end_min: end * 60 });
const A = ScheduleAction;

describe("the hours of a booking", () => {
  it.each([
    ["2-3PM", hours(14, 15)],
    ["2 to 3 pm", hours(14, 15)],
    ["2pm-3pm", hours(14, 15)],
    ["11-1pm", hours(11, 13)],
    ["11am-1", hours(11, 13)],
    ["14:00-15:30", { start_min: 840, end_min: 930 }],
    ["9:30 to 11", { start_min: 570, end_min: 660 }],
    ["2 to 3", hours(14, 15)],
    ["10-1", hours(10, 13)],
    ["5-8", hours(17, 20)],
    ["at 2 p.m.", hours(14, 15)],
    ["subah 10 se 12", hours(10, 12)],
    ["shaam 7 se 9 baje tak", hours(19, 21)],
    ["दोपहर 2 से 3 बजे", hours(14, 15)],
    ["ಮಧ್ಯಾಹ್ನ ೨ ರಿಂದ ೩ ಗಂಟೆಗೆ", hours(14, 15)],
    ["2 बजे", hours(14, 15)],
    ["10pm-12am", hours(22, 24)],
  ])("%s", (said, want) => {
    expect(timeIn(said)).toMatchObject(want);
  });

  it("reads no time where there is none, or none a clock has", () => {
    expect(timeIn("booking at 8")).toBeUndefined();
    expect(timeIn("save 2 bookings")).toBeUndefined();
    expect(timeIn("25-27 pm")).toBeUndefined();
  });

  it("prefers a time said with pm over a bare range that is a date", () => {
    expect(timeIn("booking on 5-11 at 2pm")).toMatchObject(hours(14, 15));
  });
});

describe("what a message about the schedule asks", () => {
  it.each([
    ["save my booking for tomorrow 2-3PM", { day: TOMORROW, ...hours(14, 15) }],
    ["कल दोपहर 2 से 3 बजे की बुकिंग सेव करो", { day: TOMORROW, ...hours(14, 15) }],
    ["ನಾಳೆ ಮಧ್ಯಾಹ್ನ 2 ರಿಂದ 3 ಗಂಟೆಗೆ ಬುಕಿಂಗ್ ಉಳಿಸಿ", { day: TOMORROW, ...hours(14, 15) }],
    ["kal 2 se 3 baje Sharma ji ke ghar kaam hai", { day: TOMORROW, note: "Sharma ji ke ghar" }],
    ["naale 2 inda 3 booking ide save maadi", { day: TOMORROW, ...hours(14, 15) }],
    ["Saturday 9 to 1 at the Menon flat, put it down", { day: SATURDAY, ...hours(9, 13), note: "Menon flat" }],
    ["शनिवार सुबह 8 से 11 बजे वर्मा जी के घर सफाई का काम है", { day: SATURDAY, note: "वर्मा जी के घर सफाई" }],
    ["every day 7 to 9 am at the Rao house", { day: EVERY_DAY, ...hours(7, 9), note: "Rao house" }],
  ])("keeps %s", (said, want) => {
    expect(readSchedule(said, NOW)).toMatchObject({ action: A.save, ...want });
  });

  it("books today when no day is said, or tomorrow once that time has passed", () => {
    expect(readSchedule("booking 4 to 5 pm", NOW).day).toBe(NOW.day);
    expect(readSchedule("booking 8 to 9 am", NOW).day).toBe(TOMORROW);
  });

  it("asks what is on, with or without a time", () => {
    expect(readSchedule("what's on my schedule tomorrow?", NOW)).toEqual({ action: A.list, day: TOMORROW });
    expect(readSchedule("मेरी कल की बुकिंग क्या है", NOW)).toEqual({ action: A.list, day: TOMORROW });
    expect(readSchedule("ee vaara nanna schedule alli enenide", NOW)).toEqual({ action: A.list });
    expect(readSchedule("show my booking tomorrow 2-3pm", NOW).action).toBe(A.list);
  });

  it("cancels before anything else, so a booking asked away is never kept", () => {
    expect(readSchedule("cancel my booking tomorrow 2pm", NOW)).toMatchObject({ action: A.cancel, day: TOMORROW });
    expect(readSchedule("कल 2 बजे वाली बुकिंग रद्द कर दो", NOW).action).toBe(A.cancel);
    expect(readSchedule("ನಾಳೆ 2 ಗಂಟೆಯ ಬುಕಿಂಗ್ ರದ್ದು ಮಾಡಿ", NOW).action).toBe(A.cancel);
  });

  it("does not take 'show' inside another word as a question", () => {
    expect(readSchedule("plumber job, fix the shower tomorrow 2-3pm", NOW).action).toBe(A.save);
  });
});

describe("what the word lists hear as the schedule", () => {
  it.each([
    "save my booking for tomorrow 2-3PM",
    "kal 2 se 3 baje kaam hai",
    "what bookings do I have tomorrow?",
    "kal wali booking cancel kar do",
  ])("%s", (said) => expect(soundsLikeSchedule(said)).toBe(true));

  it.each([
    "save: Kabir pays on the 5th",
    "remember I have a doctor appointment on Friday",
    "nenapitko gas booking 20ne taareeku",
    "gas booking date enu antha heliddeeni",
  ])("not %s", (said) => expect(soundsLikeSchedule(said)).toBe(false));
});

describe("the schedule in the word lists' route", () => {
  const worker = { lang: Lang.enum.en, role: ChatRole.worker, contacts: ["Ravi"] };
  it("hears a booking before a note, for workers only, and a contact's rule as a rule", () => {
    expect(keywordRoute("save my booking for tomorrow 2-3PM", worker).intent).toBe(ChatIntent.schedule);
    expect(keywordRoute("remember Kabir pays on the 5th", worker).intent).toBe(ChatIntent.remember);
    expect(keywordRoute("let Ravi see my schedule", worker).intent).toBe(ChatIntent.setRule);
    const household = { ...worker, role: ChatRole.household };
    expect(keywordRoute("save my booking for tomorrow 2-3PM", household).intent).not.toBe(ChatIntent.schedule);
  });
});
