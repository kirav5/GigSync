import { MAX_ROUNDS, Role, Trade } from "@gigsync/protocol";
import { drawStrategy, OPENING_SHARE, proposeMandate, type Random, TACTICS, type Tactic } from "../src/index.js";
import { householdMandate } from "../src/job/household-plan.js";
import { curve } from "./haggle.js";

/**
 * The counterpart in the leak test (ADR 0033 §6): it sees every offer a side makes before that side reaches its limit
 * and guesses the limit. Jobs come from the real planning code (householdMandate, proposeMandate, priceAt), on the
 * old fixed curve or on a drawn strategy.
 */

const R = Role.enum;

/** A guess this close to the limit, as a share of it, counts as found. */
export const LEAK_MARGIN = 0.04;
/** The old curve's second offer covered this share of the way: 1 - (1 - 1/4)^2. */
const OLD_SECOND_STEP = 0.4375;
const LOWEST_PAISE = 30_000;
const HIGHEST_PAISE = 2_000_000;
/** Budgets are typed in whole rupees. */
const PAISE_PER_RUPEE = 100;
/** Nearest simulated jobs the code-aware counterpart averages over. */
const NEIGHBOURS = 40;

/** The old fixed curve, or a strategy drawn with this tactic, or with one picked evenly at random. */
export const OLD = "old";
export const ANY = "any";
export type Curve = Tactic | typeof OLD | typeof ANY;

/** What the counterpart sees of one job: the offers before the limit, and (for scoring only) the limit. */
export interface Seen {
  offers: number[];
  limit: number;
}

const between = (random: Random, low: number, high: number) => low + (high - low) * random.next();
const tacticOf = (curveKind: Curve, random: Random): Tactic | undefined =>
  curveKind === OLD
    ? undefined
    : curveKind === ANY
      ? (TACTICS[Math.floor(random.next() * TACTICS.length)] ?? TACTICS[0])
      : curveKind;

/** The offers before the first one at the limit (every side is at its limit by its last round). */
function beforeLimit(offers: number[]): number[] {
  const last = offers[MAX_ROUNDS - 1];
  return offers.slice(0, offers.indexOf(last as number));
}

/** A household job: a budget, its plan and the offers a stubborn worker would see. */
export function householdJob(random: Random, kind: Curve): Seen {
  const limit = Math.round(between(random, LOWEST_PAISE, HIGHEST_PAISE) / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
  const tactic = tacticOf(kind, random);
  if (!tactic) {
    const mandate = { opening_paise: Math.round(limit * OPENING_SHARE), limit_paise: limit };
    return { offers: beforeLimit(curve(R.requester, { mandate })), limit };
  }
  const strategy = drawStrategy(R.requester, tactic, random);
  const mandate = householdMandate({ opening_paise: 0, limit_paise: limit }, strategy);
  return { offers: beforeLimit(curve(R.requester, { mandate, strategy })), limit };
}

/** A worker job: a range for it, the worker's floor below its usual price, and the offers a stubborn household sees. */
export function workerJob(random: Random, kind: Curve): Seen {
  const typical = Math.round(between(random, LOWEST_PAISE, HIGHEST_PAISE));
  const band = {
    trade: Trade.enum.cook,
    low_paise: Math.round(typical * between(random, 0.6, 0.9)),
    high_paise: Math.round(typical * between(random, 1.1, 1.5)),
    scope: [],
  };
  const plan = { band, details: {}, history: [], floor_paise: Math.round(typical * between(random, 0.55, 1)) };
  const tactic = tacticOf(kind, random);
  if (!tactic) {
    const { mandate } = proposeMandate(plan);
    return { offers: beforeLimit(curve(R.provider, { mandate })), limit: mandate.limit_paise };
  }
  const strategy = drawStrategy(R.provider, tactic, random);
  const { mandate } = proposeMandate({ ...plan, typical_paise: typical, opening_at: strategy.opening });
  return { offers: beforeLimit(curve(R.provider, { mandate, strategy })), limit: mandate.limit_paise };
}

/** A way of guessing the limit from the offers seen. */
export type Estimator = (offers: readonly number[]) => number;

const at = (offers: readonly number[], i: number) => offers[Math.max(0, Math.min(offers.length - 1, i))] as number;

/** The obvious guesses: the old formula inverted, the steps carried on in a line, and the last offer. */
export const OBVIOUS = {
  oldFormula: {
    [R.requester]: (o) => at(o, 0) / OPENING_SHARE,
    [R.provider]: (o) => (o.length < 2 ? at(o, 0) : at(o, 0) + (at(o, 1) - at(o, 0)) / OLD_SECOND_STEP),
  },
  linear: {
    [R.requester]: (o) => 2 * at(o, o.length - 1) - at(o, o.length - 2),
    [R.provider]: (o) => 2 * at(o, o.length - 1) - at(o, o.length - 2),
  },
  lastOffer: { [R.requester]: (o) => at(o, o.length - 1), [R.provider]: (o) => at(o, o.length - 1) },
} satisfies Record<string, Record<Role, Estimator>>;

/**
 * A counterpart that knows the code and the tactic: it simulates `size` jobs with the same generator and guesses the
 * limit as the median over the simulated jobs whose offers, scaled by the first, looked most like these.
 */
export function codeAware(job: (random: Random) => Seen, random: Random, size: number, first?: number): Estimator {
  const library: { shape: number[]; ratio: number }[] = [];
  for (let i = 0; i < size; i++) {
    const seen = job(random);
    const offers = first ? seen.offers.slice(0, first) : seen.offers;
    const opening = offers[0];
    if (opening) library.push({ shape: offers.map((p) => p / opening), ratio: seen.limit / opening });
  }
  return (o) => {
    const offers = first ? o.slice(0, first) : o;
    const opening = offers[0] as number;
    const shape = offers.map((p) => p / opening);
    const near = library
      .filter((l) => l.shape.length === shape.length)
      .map((l) => ({ ratio: l.ratio, d: l.shape.reduce((sum, v, i) => sum + (v - (shape[i] as number)) ** 2, 0) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEIGHBOURS)
      .map((l) => l.ratio)
      .sort((a, b) => a - b);
    return opening * (near[Math.floor(near.length / 2)] ?? 1);
  };
}

/** The share of jobs in which the guess misses the limit by more than LEAK_MARGIN. */
export function missRate(jobs: readonly Seen[], guess: Estimator): number {
  const missed = jobs.filter((j) => Math.abs(guess(j.offers) - j.limit) > LEAK_MARGIN * j.limit);
  return missed.length / jobs.length;
}

/** `count` jobs from the generator that show at least `least` offers before the limit. */
export function jobs(job: (random: Random) => Seen, random: Random, count: number, least = 1): Seen[] {
  const out: Seen[] = [];
  while (out.length < count) {
    const seen = job(random);
    if (seen.offers.length >= least) out.push(seen);
  }
  return out;
}
