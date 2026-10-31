import { describe, expect, it } from "vitest";
import { isIndianNumber, phoneSpans, REMOVED_MARK, withoutPhones } from "../src/index.js";

const X = REMOVED_MARK;

describe("Indian phone numbers in a job's words", () => {
  it("are found as people write them in English", () => {
    for (const [said, left] of [
      ["call 9800000101", `call ${X}`],
      ["Call me on +91 98450 12345 after 6", `Call me on ${X} after 6`],
      ["+91-98450-12345", X],
      ["0091 9845012345 is mine", `${X} is mine`],
      ["919845012345", X],
      ["098450 12345.", `${X}.`],
      ["office (080) 2345 6789, home 98450.12345", `office ${X}, home ${X}`],
      ["011-2345-6789 Delhi", `${X} Delhi`],
    ] as const)
      expect(withoutPhones(said)).toBe(left);
  });

  it("are found in Devanagari and Kannada digits, and mixed scripts", () => {
    expect(withoutPhones("मेरा नंबर ९८४५० १२३४५ है")).toBe(`मेरा नंबर ${X} है`);
    expect(withoutPhones("ನನ್ನ ಸಂಖ್ಯೆ ೯೮೪೫೦೧೨೩೪೫")).toBe(`ನನ್ನ ಸಂಖ್ಯೆ ${X}`);
    expect(withoutPhones("+९१ 98450 ೧೨೩೪೫")).toBe(X);
    expect(withoutPhones("ফোন ৯৮৪৫০১২৩৪৫")).toBe(`ফোন ${X}`);
  });

  it("leave prices, dates, times, counts and short numbers alone", () => {
    for (const said of [
      "₹12,000 a month, 3 rooms",
      "on 31-10-2026 at 10:30",
      "flat 302, 5th cross, 560034",
      "budget 9500 or 11000",
      "2 people, 1 dog",
      "order 12345678901234567",
      "₹500 + ₹700 = ₹1200",
    ])
      expect(withoutPhones(said)).toBe(said);
  });

  it("are told apart when two sit next to each other, and a price before one is kept", () => {
    expect(withoutPhones("9845012345 / 9876543210")).toBe(`${X} / ${X}`);
    expect(withoutPhones("₹500 9845012345")).toBe(`₹500 ${X}`);
    expect(phoneSpans("a 9845012345 b")).toEqual([[2, 12]]);
  });

  it("take a mobile as ten digits starting 6 to 9, and a landline only with its prefix", () => {
    expect(isIndianNumber("9845012345")).toBe(true);
    expect(isIndianNumber("5845012345")).toBe(false);
    expect(isIndianNumber("08023456789")).toBe(true);
    expect(isIndianNumber("01123456789")).toBe(true);
    expect(isIndianNumber("919845012345")).toBe(true);
    expect(isIndianNumber("98450123456")).toBe(false);
  });

  it("change nothing a second time", () => {
    const once = withoutPhones("call 9800000101 or ९८००००१०१०");
    expect(withoutPhones(once)).toBe(once);
  });
});
