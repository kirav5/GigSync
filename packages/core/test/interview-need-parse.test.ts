import { Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { EVERY_DAY, parseNeed } from "../src/index.js";
import { withoutMoney } from "../src/interview/need-parse.js";

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] },
  { key: "hsr_layout", names: ["HSR Layout", "एचएसआर लेआउट", "ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್", "HSR", "ಎಚ್‌ಎಸ್‌ಆರ್"] },
  { key: "jayanagar", names: ["Jayanagar", "जयनगर", "ಜಯನಗರ"] },
];
const TODAY = "2026-10-29";
const parse = (text: string) => parseNeed(text, { areas: AREAS, today: TODAY });

describe("one sentence about a need", () => {
  it("reads trade, day, time, budget and the problem from English", () => {
    const fill = parse("bedroom fan not working, need an electrician tomorrow morning, up to 700");
    expect(fill).toMatchObject({ trade: T.electrician, day: "tomorrow", time: "morning", budget_paise: 70_000 });
    expect(fill.area).toBeUndefined();
    // The budget never travels in the words the workers read.
    expect(fill.words).toBe("bedroom fan not working, need an electrician tomorrow morning");
    expect(fill.details.problem).toBe(fill.words);
  });

  it("reads Hindi, with कल as tomorrow and a clock time", () => {
    const fill = parse("कल सुबह 10 बजे कोरमंगला में प्लंबर चाहिए, नल टपक रहा है, 500 रुपये तक");
    expect(fill).toMatchObject({ trade: T.plumber, area: "koramangala", day: "tomorrow", budget_paise: 50_000 });
    expect(fill.time).toBe("सुबह 10 बजे");
    expect(fill.details.problem).toBeDefined();
    expect(fill.words).not.toContain("500");
  });

  it("reads Kannada", () => {
    const fill = parse("ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಜಯನಗರದಲ್ಲಿ ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ಬೇಕು, ಫ್ಯಾನ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ");
    expect(fill).toMatchObject({ trade: T.electrician, area: "jayanagar", day: "tomorrow", time: "ಬೆಳಿಗ್ಗೆ" });
    expect(fill.details.problem).toBeDefined();
    expect(fill.budget_paise).toBeUndefined();
  });

  it("reads every day in each language", () => {
    expect(parse("need a cook every day").day).toBe(EVERY_DAY);
    expect(parse("रोज़ खाना बनाने वाली चाहिए").day).toBe(EVERY_DAY);
    expect(parse("ಪ್ರತಿದಿನ ಅಡುಗೆಯವರು ಬೇಕು").day).toBe(EVERY_DAY);
    expect(parse("आज शाम को").day).toBe("today");
    expect(parse("ಇಂದು ಸಂಜೆ").day).toBe("today");
  });

  it("reads dates, the next one to come", () => {
    expect(parse("painter on 5/11").day).toBe("2026-11-05");
    expect(parse("painter on 5 November").day).toBe("2026-11-05");
    expect(parse("15 जनवरी को").day).toBe("2027-01-15");
    expect(parse("day after tomorrow").day).toBe("2026-10-31");
    expect(parse("परसों आना").day).toBe("2026-10-31");
    expect(parse("on 31/2").day).toBeUndefined();
  });

  it("counts a number as money only beside a money word", () => {
    const cook = parse("cook for 3 people, every day");
    expect(cook.budget_paise).toBeUndefined();
    expect(cook.details.people).toBe("3 people");
    expect(parse("cook for 3 people, budget 9000").budget_paise).toBe(900_000);
    expect(parse("maid for 2bhk, ₹4,000").budget_paise).toBe(400_000);
    expect(parse("ಮನೆಗೆಲಸಕ್ಕೆ 2 ಕೋಣೆ, 4000 ರೂಪಾಯಿ ವರೆಗೆ").budget_paise).toBe(400_000);
    expect(parse("plumber tomorrow at 10 am").budget_paise).toBeUndefined();
    expect(parse("सात सौ रुपये तक").budget_paise).toBe(70_000);
  });

  it("knows the trade from the broken thing, and urgency as today", () => {
    expect(parse("the kitchen sink is blocked, asap")).toMatchObject({ trade: T.plumber, day: "today" });
    expect(parse("पंखा नहीं चल रहा, अभी आ जाइए")).toMatchObject({ trade: T.electrician, day: "today" });
    expect(parse("AC fan is noisy").trade).toBe(T.ac_technician);
  });

  it("says nothing about what it did not hear", () => {
    const fill = parse("hello");
    expect(fill).toEqual({ details: {}, words: "hello" });
  });

  it("does not take a near miss for an area inside a sentence", () => {
    expect(parse("need a jayanagr electrician").area).toBeUndefined();
  });
});

describe("the words workers read", () => {
  it("drops only the clauses with the budget", () => {
    expect(withoutMoney("Fan broken. Up to 700 rupees.")).toBe("Fan broken.");
    expect(withoutMoney("up to 700")).toBe("");
    expect(withoutMoney("2 rooms, 10.30 am")).toBe("2 rooms, 10.30 am");
  });
});
