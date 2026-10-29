import { CostPer, type GuideCost } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CASH_PLAN_DAYS, cashPlan } from "../src/index.js";
import { BENGALURU } from "./landing-fixtures.js";

const P = CostPer.enum;
const SOURCE = "https://example.org/fares";
const cost = (item: string, amount_paise: number | undefined, more: Partial<GuideCost> = {}): GuideCost => ({
  item,
  amount: "as written",
  ...(amount_paise === undefined ? {} : { amount_paise }),
  year: 2026,
  detail: "detail",
  source: SOURCE,
  ...more,
});

/** Costs shaped like the draft's: three bus passes that are ways to pay for the same travel, two fees, one unknown. */
const COSTS: GuideCost[] = [
  cost("Bus day pass", 8_000, { per: P.day, choice: "bus-pass" }),
  cost("Bus weekly pass", 35_000, { per: P.week, choice: "bus-pass" }),
  cost("Bus monthly pass", 120_000, { per: P.month, choice: "bus-pass" }),
  cost("Aadhaar address update", 7_500, { per: P.once }),
  cost("e-Shram registration", 0, { per: P.once }),
  cost("Police verification", undefined),
];

describe("the first-month cash plan", () => {
  it("covers 30 days from the arrival day", () => {
    const plan = cashPlan(COSTS, "2026-11-16");
    expect(plan.from).toBe("2026-11-16");
    expect(plan.to).toBe("2026-12-15");
    expect(CASH_PLAN_DAYS).toBe(30);
  });

  it("counts the cheapest way to pay among alternatives: one monthly pass when the 30 days are one month", () => {
    const plan = cashPlan(COSTS, "2026-11-01");
    expect(plan.lines.map((l) => [l.cost.item, l.times, l.paise])).toEqual([
      ["Bus monthly pass", 1, 120_000],
      ["Aadhaar address update", 1, 7_500],
      ["e-Shram registration", 1, 0],
    ]);
    expect(plan.total_paise).toBe(127_500);
  });

  it("takes weekly passes when the 30 days touch two calendar months", () => {
    // Monthly passes would be 2 × Rs 1,200; five weekly passes are Rs 1,750; 30 day passes Rs 2,400.
    const plan = cashPlan(COSTS, "2026-11-16");
    expect(plan.lines[0]).toMatchObject({ times: 5, paise: 175_000 });
    expect(plan.total_paise).toBe(175_000 + 7_500);
  });

  it("counts three calendar months for 30 days from 31 January", () => {
    const monthly = [cost("Monthly pass", 100_000, { per: P.month })];
    expect(cashPlan(monthly, "2027-01-31").lines[0]?.times).toBe(3);
  });

  it("lists costs with no number as not known yet, and adds nothing for them", () => {
    const plan = cashPlan(COSTS, "2026-11-01");
    expect(plan.unknown.map((c) => c.item)).toEqual(["Police verification"]);
  });

  it("counts a cost with no frequency once", () => {
    expect(cashPlan([cost("Fee", 5_000)], "2026-11-01").total_paise).toBe(5_000);
  });

  it("adds up the Bengaluru guide without counting two bus passes", () => {
    // Arriving mid-month: five weekly passes (Rs 1,750) and the Aadhaar address fee (Rs 75); e-Shram is free.
    const plan = cashPlan(BENGALURU.costs, "2026-11-16");
    expect(plan.total_paise).toBe(175_000 + 7_500);
    expect(plan.lines.filter((l) => l.cost.choice !== undefined)).toHaveLength(1);
    expect(plan.unknown.map((c) => c.item)).toEqual(["Police verification on Seva Sindhu"]);
  });
});
