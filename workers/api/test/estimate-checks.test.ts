import type { EstimateRequest } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { estimateUnit, inRequestUnit, visitsPerMonth } from "../src/estimates/normalise.js";
import { amountsIn, normaliseText, pageKey, writesAmount } from "../src/estimates/text.js";
import { type CheckedQuote, checkQuotes, DropReason } from "../src/estimates/verify.js";
import { COOK, ELECTRICIAN, MAID, PAINTER } from "./estimate-fakes.js";

const URL_A = "https://www.homepaint.example/bengaluru/cost";
const PAGE = "Painting guide.\n\nA **2BHK repaint** in Bengaluru costs ₹14,000 – ₹18,000   for labour only.";
const SENTENCE = "A 2BHK repaint in Bengaluru costs ₹14,000 - ₹18,000 for labour only.";
const quote = (more: Record<string, unknown> = {}) => ({
  url: URL_A,
  sentence: SENTENCE,
  amount_rupees: 14000,
  unit: "job",
  covers: { rooms: 2, materials_included: false },
  site: "homepaint.example",
  ...more,
});
const check = (...quotes: unknown[]) => checkQuotes({ pages: [{ url: URL_A, text: PAGE }], quotes });

describe("amounts in a sentence", () => {
  it("reads rupees as Indian pages write them", () => {
    expect(amountsIn("₹14,000 to Rs. 22,000/- a month")).toEqual([14000, 22000]);
    expect(amountsIn("Rs 1,50,000 or ₹1.5 lakh or 2 lakhs")).toEqual([150000, 150000, 200000]);
    expect(amountsIn("about 15k, ₹12.50 per sq ft, 3 thousand")).toEqual([15000, 12.5, 3000]);
    expect(amountsIn("INR 9000 for 2BHK")).toEqual([9000, 2]);
  });

  it("does not split a number or borrow a scale word from a neighbour", () => {
    expect(amountsIn("14000rs")).toEqual([14000]);
    expect(amountsIn("14-22k")).toEqual([14, 22000]);
    expect(amountsIn("15kg of putty")).toEqual([15]);
  });

  it("matches an amount to the paisa", () => {
    expect(writesAmount("₹12.50 per sq ft", 12.5)).toBe(true);
    expect(writesAmount("₹12.50 per sq ft", 12.4)).toBe(false);
    expect(writesAmount("₹14,000 a month", 1400)).toBe(false);
  });
});

describe("page text", () => {
  it("normalises case, spacing, dashes, quotes and emphasis", () => {
    expect(normaliseText("  A **2BHK’s**  cost — ₹14,000\n")).toBe("a 2bhk's cost - ₹14,000");
  });

  it("identifies a page without www, a trailing slash or a fragment", () => {
    expect(pageKey("https://www.Example.in/cost/#top")).toBe(pageKey("https://example.in/cost"));
    expect(pageKey("https://example.in/cost?city=blr")).not.toBe(pageKey("https://example.in/cost"));
    expect(pageKey("not a url")).toBeUndefined();
  });
});

describe("checking quotes against the fetched pages", () => {
  it("keeps a quote whose sentence is on its page and whose number is in its sentence", () => {
    const { kept, dropped } = check(
      quote(),
      quote({ amount_rupees: 18000, url: "https://homepaint.example/bengaluru/cost/" }),
    );
    expect(dropped).toEqual([]);
    expect(kept.map((q) => q.amount_rupees)).toEqual([14000, 18000]);
    expect(kept[0]?.url).toBe(URL_A);
    expect(kept[0]?.site).toBe("homepaint.example");
  });

  it("drops a sentence that is not on the page", () => {
    const made = quote({ sentence: "A 2BHK repaint in Bengaluru costs ₹15,000 on average.", amount_rupees: 15000 });
    expect(check(made).dropped).toEqual([DropReason.sentenceNotOnPage]);
  });

  it("drops a number that is not in the sentence", () => {
    expect(check(quote({ amount_rupees: 16000 })).dropped).toEqual([DropReason.amountNotInSentence]);
  });

  it("drops a quote from a page that was never fetched, and malformed or out-of-range quotes", () => {
    const { dropped } = check(
      quote({ url: "https://elsewhere.example/cost" }),
      quote({ url: "nonsense" }),
      quote({ amount_rupees: -5 }),
      quote({ amount_rupees: 50_00_000 }),
      quote({ unit: "fortnight" }),
      "just text",
    );
    expect(dropped).toEqual([
      DropReason.noPage,
      DropReason.malformed,
      DropReason.malformed,
      DropReason.malformed,
      DropReason.malformed,
      DropReason.malformed,
    ]);
  });

  it("drops a sentence too short to prove anything, or too long to show, and repeats", () => {
    const { dropped } = check(quote({ sentence: "₹14,000" }), quote({ sentence: "x".repeat(501) }), quote(), quote());
    expect(dropped).toEqual([DropReason.sentenceTooShort, DropReason.sentenceTooLong, DropReason.duplicate]);
  });
});

const checked = (more: Partial<CheckedQuote>): CheckedQuote => ({
  url: URL_A,
  site: "homepaint.example",
  sentence: SENTENCE,
  amount_rupees: 1000,
  unit: "month",
  covers: {},
  ...more,
});

describe("normalising to the request's unit and scope", () => {
  it("prices each trade in its own unit", () => {
    expect(estimateUnit(COOK)).toBe("month");
    expect(estimateUnit(ELECTRICIAN)).toBe("job");
    expect(estimateUnit(PAINTER)).toBe("job");
    expect(estimateUnit({ ...PAINTER, scope: { labour_only: "yes" } } as EstimateRequest)).toBe("sqft");
  });

  it("turns a day, visit or hour into a month of the job's days", () => {
    expect(visitsPerMonth(COOK)).toBe(26);
    expect(visitsPerMonth({ ...MAID, scope: { rooms: "bhk2", frequency: "alternate_days" } } as EstimateRequest)).toBe(
      13,
    );
    expect(inRequestUnit(checked({ unit: "day", amount_rupees: 400 }), COOK)).toBe(10400);
    expect(inRequestUnit(checked({ unit: "hour", amount_rupees: 100, covers: { hours: 2 } }), COOK)).toBe(5200);
    expect(inRequestUnit(checked({ unit: "hour", amount_rupees: 100 }), COOK)).toBe(DropReason.unitMismatch);
    expect(inRequestUnit(checked({ unit: "job" }), COOK)).toBe(DropReason.unitMismatch);
  });

  it("turns a painting price per sq ft or per day into a job when the quote says the area or the days", () => {
    const labour = { rooms: 2, materials_included: false };
    expect(
      inRequestUnit(checked({ unit: "sqft", amount_rupees: 12, covers: { ...labour, area_sqft: 1000 } }), PAINTER),
    ).toBe(12000);
    expect(inRequestUnit(checked({ unit: "day", amount_rupees: 900, covers: { ...labour, days: 10 } }), PAINTER)).toBe(
      9000,
    );
    expect(inRequestUnit(checked({ unit: "sqft", amount_rupees: 12, covers: labour }), PAINTER)).toBe(
      DropReason.unitMismatch,
    );
    const perSqft = { ...PAINTER, scope: { labour_only: "yes" } } as EstimateRequest;
    const job = checked({ unit: "job", amount_rupees: 15000, covers: { materials_included: false, area_sqft: 1000 } });
    expect(inRequestUnit(job, perSqft)).toBe(15);
  });

  it("drops a repair's visiting charge: only a whole-job price counts", () => {
    expect(inRequestUnit(checked({ unit: "visit", amount_rupees: 299 }), ELECTRICIAN)).toBe(DropReason.unitMismatch);
    expect(inRequestUnit(checked({ unit: "job", amount_rupees: 450 }), ELECTRICIAN)).toBe(450);
  });

  it("is strict about paint and size for painting, lenient about unstated details elsewhere", () => {
    const job = (covers: CheckedQuote["covers"]) =>
      inRequestUnit(checked({ unit: "job", amount_rupees: 15000, covers }), PAINTER);
    expect(job({ rooms: 2, materials_included: false })).toBe(15000);
    expect(job({ rooms: 2, materials_included: true })).toBe(DropReason.scopeMismatch);
    expect(job({ rooms: 2 })).toBe(DropReason.scopeMismatch);
    expect(job({ materials_included: false })).toBe(DropReason.scopeMismatch);
    expect(job({ rooms: 3, materials_included: false })).toBe(DropReason.scopeMismatch);
    expect(inRequestUnit(checked({ covers: {} }), COOK)).toBe(1000);
    expect(inRequestUnit(checked({ covers: { people: 6 } }), COOK)).toBe(DropReason.scopeMismatch);
    expect(inRequestUnit(checked({ covers: { meals: 3 } }), COOK)).toBe(DropReason.scopeMismatch);
    expect(inRequestUnit(checked({ covers: { rooms: 2 } }), MAID)).toBe(1000);
    expect(inRequestUnit(checked({ covers: { rooms: 4 } }), MAID)).toBe(DropReason.scopeMismatch);
  });
});
