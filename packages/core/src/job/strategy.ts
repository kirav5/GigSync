import { MAX_ROUNDS, Role } from "@gigsync/protocol";
import type { Random } from "../ports.js";

/**
 * Hidden settings for one job's negotiation (ADR 0033 §1). When a side's agent first plans a job, its phone draws them
 * from the platform's cryptographic random source; they are stored with the job and never leave the phone. A fixed
 * curve let the other side work the limit out from the first offer or two; with these, the same limits settle at
 * different prices and the offers only narrow the limit to a range. Code still keeps every bound: no offer passes the
 * owner's limit (job/negotiate.ts).
 *
 * The curve is not a power curve with jitter: each offer concedes a share of the gap still left to the limit, drawn
 * on its own, and the last offer before the horizon jumps the rest of the way. In simulation a power curve with ±40%
 * jitter let a counterpart guess the limit within 4% from the steps in about half the jobs, because the steps give
 * the exponent away; independent shares do not (test/negotiate-leak.test.ts).
 */

/** How the owner wants their agent to bargain; a model picks one from the owner's own words (job/tactic.ts). */
export const Tactic = { patient: "patient", steady: "steady", quick: "quick" } as const;
export type Tactic = (typeof Tactic)[keyof typeof Tactic];

/** In the order Settings shows them. */
export const TACTICS: readonly Tactic[] = [Tactic.patient, Tactic.steady, Tactic.quick];

/** Without a model, an owner's choice or a clear answer, the agent bargains steadily. */
export const DEFAULT_TACTIC: Tactic = Tactic.steady;

/** A closed range, low to high. */
export type Range = readonly [low: number, high: number];

/** What each tactic narrows the random draws to. The ranges overlap on purpose: a tactic must not give a job away. */
export interface TacticRanges {
  /** Household: its opening as a share of its budget. */
  share: Range;
  /** Worker: its opening's place between the job's usual price (0) and the top of its range (1). */
  position: Range;
  /** The share of the gap still left to its limit that each offer gives up. */
  concede: Range;
  /** The offer by which the agent has come all the way to its limit (whole numbers). */
  horizon: Range;
  /** Accept an acceptable offer this close to its own next one, as a share of that offer. */
  closeness: Range;
}

/**
 * Patient opens further away, gives up less each time, comes to its limit late and haggles closer; quick the reverse.
 * Tuned with the leak test: each range is wide enough that a counterpart who knows the tactic still cannot fit the
 * limit from the offers it sees.
 */
export const TACTIC_RANGES: Readonly<Record<Tactic, TacticRanges>> = {
  [Tactic.patient]: {
    share: [0.35, 0.65],
    position: [0.6, 1],
    concede: [0.06, 0.3],
    horizon: [4, 5],
    closeness: [0.02, 0.035],
  },
  [Tactic.steady]: {
    share: [0.4, 0.9],
    position: [0.3, 1],
    concede: [0.1, 0.36],
    horizon: [3, 5],
    closeness: [0.03, 0.05],
  },
  [Tactic.quick]: {
    share: [0.5, 0.9],
    position: [0, 0.7],
    concede: [0.12, 0.38],
    horizon: [3, 4],
    closeness: [0.04, 0.06],
  },
};

/** One job's hidden settings, stored on the job record only. */
export interface Strategy {
  tactic: Tactic;
  /** Household: the share of its budget it opens at. Worker: its opening's place in the job's range (`position`). */
  opening: number;
  /** Per offer after the first, the share of the gap still left that it gives up. */
  concede: number[];
  /** The offer by which it has conceded all the way to its limit. */
  horizon: number;
  /** How close another's offer must be to its own next one to accept it. */
  closeness: number;
}

/** A number drawn evenly from the range. */
const draw = (random: Random, [low, high]: Range): number => low + (high - low) * random.next();

/** A whole number drawn evenly from the range, ends included; a source that returns 1 still lands inside. */
const drawWhole = (random: Random, [low, high]: Range): number =>
  Math.min(high, low + Math.floor(random.next() * (high - low + 1)));

/** Draws a job's hidden settings for this side and tactic. */
export function drawStrategy(role: Role, tactic: Tactic, random: Random): Strategy {
  const ranges = TACTIC_RANGES[tactic];
  const opening = draw(random, role === Role.enum.provider ? ranges.position : ranges.share);
  // One share per step between offers; the last offer is the limit itself, so there are at most MAX_ROUNDS - 2.
  const concede = Array.from({ length: MAX_ROUNDS - 2 }, () => draw(random, ranges.concede));
  return {
    tactic,
    opening,
    concede,
    horizon: drawWhole(random, ranges.horizon),
    closeness: draw(random, ranges.closeness),
  };
}

/**
 * How far this side has come from its opening toward its limit by its `round`-th offer: 0 at the opening, 1 from the
 * horizon on, and never less than the offer before.
 */
export function conceded(s: Strategy, round: number): number {
  if (round >= s.horizon) return 1;
  let left = 1;
  for (let step = 0; step < round - 1; step++) left *= 1 - Math.min(1, Math.max(0, s.concede[step] ?? 0));
  return 1 - left;
}
