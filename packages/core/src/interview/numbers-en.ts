import type { NumberWords } from "./amount.js";

/**
 * English number words, with the multiplier Indian English uses (lakh). Twenty-one to ninety-nine are said as two
 * words, a ten then a unit, which the parser adds. Romanized Hindi ("das hazar") is left out on purpose: without its
 * number words, "hazar" alone would read as ₹1,000; unread, the interview asks again instead.
 */
export const EN_NUMBERS: NumberWords = {
  values: {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  },
  multipliers: {
    hundred: 100,
    thousand: 1000,
    k: 1000,
    lakh: 100_000,
    lakhs: 100_000,
    lac: 100_000,
  },
};
