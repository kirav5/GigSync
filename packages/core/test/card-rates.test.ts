import { Arrangement, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { cardRatesOf } from "../src/index.js";

const A = Arrangement.enum;
const T = Trade.enum;

describe("the rates a card shows (ADR 0053 §7)", () => {
  it("gives every arrangement its own rate, in order, whichever way the card lists them", () => {
    const arrangements = [
      { arrangement: A.monthly, rate_paise: 900_000 },
      { arrangement: A.hourly, rate_paise: 18_000 },
    ];
    expect(cardRatesOf({ trades: [T.maid], arrangements, rate_paise: 900_000 })).toEqual([
      { arrangement: A.hourly, rate_paise: 18_000 },
      { arrangement: A.monthly, rate_paise: 900_000 },
    ]);
  });

  it("reads a repair's one rate as a visit, on a card published before arrangements", () => {
    expect(cardRatesOf({ trades: [T.electrician], rate_paise: 20_000 })).toEqual([
      { arrangement: A.visit, rate_paise: 20_000 },
    ]);
  });

  it("reads a cook's one rate as a month, as every card once meant", () => {
    expect(cardRatesOf({ trades: [T.cook], rate_paise: 1_100_000 })).toEqual([
      { arrangement: A.monthly, rate_paise: 1_100_000 },
    ]);
  });

  it("gives a card of a worker's own skills no unit", () => {
    expect(cardRatesOf({ trades: [], rate_paise: 50_000 })).toEqual([{ rate_paise: 50_000 }]);
  });
});
