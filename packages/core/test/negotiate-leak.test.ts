import { Role } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type Random, TACTICS } from "../src/index.js";
import {
  ANY,
  type Curve,
  codeAware,
  householdJob,
  jobs,
  LEAK_MARGIN,
  missRate,
  OBVIOUS,
  OLD,
  type Seen,
  workerJob,
} from "./leak.js";
import { seeded } from "./random.js";

/**
 * The attacker test (ADR 0033 §6). A counterpart sees every offer a side makes before it reaches its limit and
 * guesses the limit; a guess within LEAK_MARGIN of it counts as found. On the old fixed curve the inverted formula
 * finds the household's budget from its first offer and the worker's floor from their first two, in nearly every job.
 * On drawn strategies the obvious guesses miss in at least MUST_MISS of jobs.
 *
 * What remains, said plainly: an offer still bounds the limit to a range, so a counterpart who knows the code and
 * the tactic does better than the obvious guesses. From the first offers it still misses in most jobs (CODE_FIRST_MISS);
 * holding out until just before the limit it gets within the margin in roughly half of them, one offer before it would
 * see the limit anyway. A stubborn counterpart always learns the limit at the end: that is the limit doing its job.
 */

const R = Role.enum;
const JOBS = 2000;
/** Each obvious guess misses the limit by more than LEAK_MARGIN in at least this share of jobs, tactics mixed. */
const MUST_MISS = 0.9;
/**
 * The same, when the counterpart knows the tactic (it reads the household's words, which may say "today"): one
 * offer bounds the budget to its tactic's range, so a fixed guess like the old formula lands in it now and then.
 */
const PER_TACTIC_MISS = 0.85;
/** On the old curve the inverted formula found the limit in at least this share of jobs. */
const OLD_FOUND = 0.99;
/** A counterpart that knows the code and the tactic, from the first offer (household) or first two (worker). */
const CODE_FIRST_MISS = 0.65;
/** The same counterpart, from every offer before the limit. */
const CODE_ALL_MISS = 0.4;
/** Simulated jobs the code-aware counterpart learns from, and jobs it guesses. */
const LIBRARY = 6000;
const GUESSED = 400;
const SLOW_MS = 60_000;

type Generator = (random: Random, kind: Curve) => Seen;
const SIDES: readonly { role: Role; job: Generator; first: number }[] = [
  { role: R.requester, job: householdJob, first: 1 },
  { role: R.provider, job: workerJob, first: 2 },
];

describe("the limits do not leak from the offers", () => {
  for (const { role, job, first } of SIDES) {
    it(`on the old fixed curve, the ${role}'s limit is found from its first offers`, () => {
      const seen = jobs((r) => job(r, OLD), seeded(11), JOBS, first);
      expect(1 - missRate(seen, OBVIOUS.oldFormula[role])).toBeGreaterThanOrEqual(OLD_FOUND);
    });

    it(`on drawn strategies, every obvious guess at the ${role}'s limit misses by more than ${LEAK_MARGIN * 100}%`, () => {
      const mixed = jobs((r) => job(r, ANY), seeded(12), JOBS, first);
      for (const guess of Object.values(OBVIOUS))
        expect(missRate(mixed, guess[role])).toBeGreaterThanOrEqual(MUST_MISS);
      for (const tactic of TACTICS) {
        const known = jobs((r) => job(r, tactic), seeded(13), JOBS, first);
        for (const guess of Object.values(OBVIOUS))
          expect(missRate(known, guess[role])).toBeGreaterThanOrEqual(PER_TACTIC_MISS);
      }
    });

    it(
      `a counterpart that knows the code and the tactic still misses the ${role}'s limit in most jobs`,
      () => {
        for (const tactic of TACTICS) {
          const make = (r: Random) => job(r, tactic);
          const seen = jobs(make, seeded(14), GUESSED, first);
          expect(missRate(seen, codeAware(make, seeded(15), LIBRARY, first))).toBeGreaterThanOrEqual(CODE_FIRST_MISS);
          expect(missRate(seen, codeAware(make, seeded(16), LIBRARY))).toBeGreaterThanOrEqual(CODE_ALL_MISS);
        }
      },
      SLOW_MS,
    );
  }
});
