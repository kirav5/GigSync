import { describe, expect, it } from "vitest";
import { parseAmount } from "../src/index.js";

const rupees = (text: string) => {
  const paise = parseAmount(text);
  return paise === undefined ? undefined : paise / 100;
};

describe("amounts in digits", () => {
  it.each([
    ["७०००", 7000],
    ["೭೦೦೦", 7000],
    ["7,000", 7000],
    ["₹7000", 7000],
    ["7000 रुपये", 7000],
    ["7000रु", 7000],
    ["Rs. 7000/-", 7000],
    ["ರೂ 7000", 7000],
    ["7k", 7000],
    ["1,20,000", 120000],
    ["7000.50", 7000.5],
  ])("reads %s", (text, value) => {
    expect(rupees(text)).toBe(value);
  });

  it("allows a decimal before a multiplier, and digits mixed with words", () => {
    expect(rupees("8.5 हज़ार")).toBe(8500);
    expect(rupees("7 हज़ार")).toBe(7000);
    expect(rupees("साढ़े 8 हज़ार")).toBe(8500);
  });
});

describe("amounts in words", () => {
  it.each([
    ["सात हज़ार", 7000],
    ["सात हजार", 7000],
    ["नौ हज़ार", 9000],
    ["साढ़े आठ हज़ार", 8500],
    ["साढ़े सात हज़ार", 7500],
    ["डेढ़ सौ", 150],
    ["ढाई हज़ार", 2500],
    ["सवा सौ", 125],
    ["पौने तीन सौ", 275],
    ["दो लाख पचास हज़ार", 250000],
    ["पाँच सौ पचास", 550],
    ["पांच सौ", 500],
    ["ಎಂಟು ಸಾವಿರದ ಐನೂರು", 8500],
    ["ಎಂಟೂವರೆ ಸಾವಿರ", 8500],
    ["ಒಂದೂವರೆ ಸಾವಿರ", 1500],
    ["ಎರಡೂವರೆ ಸಾವಿರ", 2500],
    ["ಏಳು ಸಾವಿರ", 7000],
    ["ಎಂಟುಸಾವಿರ", 8000],
    ["ಇನ್ನೂರ ಐವತ್ತು", 250],
    ["nine thousand five hundred", 9500],
    ["twenty five thousand", 25000],
    ["eight and a half thousand", 8500],
    ["a thousand", 1000],
    ["two lakh", 200000],
  ])("reads %s", (text, value) => {
    expect(rupees(text)).toBe(value);
  });

  it.each([
    ["उन्नीस", 19],
    ["उनीस", 19],
    ["उनतीस", 29],
    ["पैंतीस", 35],
    ["उनतालीस", 39],
    ["पैंतालीस", 45],
    ["उनचास", 49],
    ["उनसठ", 59],
    ["उनहत्तर", 69],
    ["पचहत्तर", 75],
    ["उनासी", 79],
    ["पचासी", 85],
    ["नवासी", 89],
    ["पंचानवे", 95],
    ["निन्यानवे", 99],
  ])("knows the Hindi word %s is %i", (word, value) => {
    expect(rupees(`${word} सौ`)).toBe(value * 100);
    expect(rupees(word)).toBe(value);
  });

  it.each([
    ["ಹನ್ನೆರಡು", 12],
    ["ಹದಿನೆಂಟು", 18],
    ["ಇಪ್ಪತ್ತೈದು", 25],
    ["ನಲವತ್ತೈದು", 45],
    ["ಐವತ್ತು", 50],
    ["ಎಪ್ಪತ್ತೈದು", 75],
    ["ತೊಂಬತ್ತೊಂಬತ್ತು", 99],
  ])("knows the Kannada word %s is %i", (word, value) => {
    expect(rupees(word)).toBe(value);
  });
});

describe("which amount", () => {
  it("takes the first amount in the answer", () => {
    expect(rupees("मैं आठ हज़ार लेती हूँ, कम से कम सात हज़ार")).toBe(8000);
    expect(rupees("7000 a month, 6000 at least")).toBe(7000);
  });

  it("passes over a lone small number when a real amount follows", () => {
    expect(rupees("एक बार आने का पाँच सौ")).toBe(500);
    expect(rupees("ಒಂದು ಸಲಕ್ಕೆ ಐನೂರು")).toBe(500);
    expect(rupees("1 visit 500")).toBe(500);
  });

  it("keeps a lone small number when there is nothing else, for the amount check to catch", () => {
    expect(rupees("सात")).toBe(7);
  });

  it("does not read a number out of a longer word", () => {
    expect(rupees("नौकरी")).toBeUndefined();
    expect(rupees("हाँ")).toBeUndefined();
    expect(rupees("")).toBeUndefined();
  });

  it("leaves romanized Hindi alone rather than misread it", () => {
    expect(rupees("das hazar")).toBeUndefined();
  });

  it("does not add two numbers that are not one amount", () => {
    expect(rupees("7000 8000")).toBe(7000);
  });
});
