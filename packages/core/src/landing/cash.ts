import { CostPer, type GuideCost } from "@gigsync/protocol";

/**
 * A rough first-month cash plan from the guide's costs and the owner's arrival day: what the listed costs come to
 * over the first 30 days. Only `amount_paise` is added up, never the words people read. Costs that are ways to pay
 * for the same thing (a bus day pass, weekly pass, monthly pass) share a `choice`, and only the cheapest way to cover
 * the 30 days counts. Costs with no number are listed as not known yet. It is an estimate from a draft guide, and the
 * screens say so.
 */

/** The days the plan covers, from the arrival day. */
export const CASH_PLAN_DAYS = 30;
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const MONTHS_PER_YEAR = 12;
const DAY_LENGTH = 10;

/** One cost counted in the plan: how many times it is paid in the 30 days, and what that comes to. */
export interface CashLine {
  cost: GuideCost;
  times: number;
  paise: number;
}

export interface CashPlan {
  /** First and last day covered, `YYYY-MM-DD`. */
  from: string;
  to: string;
  total_paise: number;
  lines: CashLine[];
  /** Costs the guide has no number for. */
  unknown: GuideCost[];
}

const dayAfter = (day: string, days: number): string =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * MS_PER_DAY).toISOString().slice(0, DAY_LENGTH);

/** How many calendar months the days from `from` to `to` touch (Jan 31 to Mar 1 touches three). */
function monthsTouched(from: string, to: string): number {
  const index = (day: string) => {
    const at = new Date(`${day}T00:00:00Z`);
    return at.getUTCFullYear() * MONTHS_PER_YEAR + at.getUTCMonth();
  };
  return index(to) - index(from) + 1;
}

/** How many times a cost paid `per` falls in the days from `from` to `to`: a monthly cost is per calendar month. */
function timesIn(per: CostPer, from: string, to: string): number {
  const P = CostPer.enum;
  if (per === P.day) return CASH_PLAN_DAYS;
  if (per === P.week) return Math.ceil(CASH_PLAN_DAYS / DAYS_PER_WEEK);
  if (per === P.month) return monthsTouched(from, to);
  return 1;
}

/** The plan for the guide's costs over the 30 days from `arrival` (`YYYY-MM-DD`). */
export function cashPlan(costs: readonly GuideCost[], arrival: string): CashPlan {
  const from = arrival;
  const to = dayAfter(arrival, CASH_PLAN_DAYS - 1);
  const unknown = costs.filter((c) => c.amount_paise === undefined);
  const priced: CashLine[] = [];
  for (const cost of costs) {
    if (cost.amount_paise === undefined) continue;
    const times = timesIn(cost.per ?? CostPer.enum.once, from, to);
    priced.push({ cost, times, paise: cost.amount_paise * times });
  }
  // Within a choice, the cheapest way counts; the first in the guide wins a tie.
  const cheapest = new Map<string, CashLine>();
  for (const line of priced) {
    const choice = line.cost.choice;
    if (choice === undefined) continue;
    const kept = cheapest.get(choice);
    if (!kept || line.paise < kept.paise) cheapest.set(choice, line);
  }
  const lines = priced.filter((l) => l.cost.choice === undefined || cheapest.get(l.cost.choice) === l);
  return { from, to, total_paise: lines.reduce((sum, l) => sum + l.paise, 0), lines, unknown };
}
