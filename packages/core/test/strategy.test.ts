import { MAX_ROUNDS, Role } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  conceded,
  drawStrategy,
  type Mandate,
  MoveKind,
  PRICE_STEP_PAISE,
  priceAt,
  type Random,
  type Strategy,
  TACTIC_RANGES,
  TACTICS,
} from "../src/index.js";
import { householdMandate } from "../src/job/household-plan.js";
import { curve, haggle, type Side } from "./haggle.js";
import { seeded } from "./random.js";

/**
 * Property tests over thousands of seeded jobs (ADR 0033 §6): whatever the draw, code keeps every bound. No offer
 * passes the owner's limit or the legal minimum, offers are whole ₹10s and never move back toward the opening, the
 * limit is reached by the horizon, and no side makes more than MAX_ROUNDS offers.
 */

const R = Role.enum;
const JOBS = 3000;
const LOWEST_PAISE = 20_000;
const HIGHEST_PAISE = 2_000_000;
/** A worker's opening is at most this far above their limit in these jobs. */
const MAX_MARKUP = 1.8;
/** One job in this many has a legal minimum, somewhere around the limit. */
const LEGAL_EVERY = 3;

const between = (random: Random, low: number, high: number) => low + (high - low) * random.next();
const pickTactic = (random: Random) => TACTICS[Math.floor(random.next() * TACTICS.length)] ?? TACTICS[0];
const steps = (round: (x: number) => number, paise: number) => round(paise / PRICE_STEP_PAISE) * PRICE_STEP_PAISE;
const within = (value: number, [low, high]: readonly [number, number]) => value >= low && value <= high;

/** A random job for one side: its limit, opening, maybe a legal minimum, and its drawn strategy. */
function randomSide(role: Role, random: Random): Side & { strategy: Strategy } {
  const strategy = drawStrategy(role, pickTactic(random), random);
  const limit = Math.round(between(random, LOWEST_PAISE, HIGHEST_PAISE));
  const legal = random.next() * LEGAL_EVERY < 1 ? { legal_paise: Math.round(limit * between(random, 0.6, 1.2)) } : {};
  const mandate: Mandate =
    role === R.provider
      ? { opening_paise: Math.round(limit * between(random, 1, MAX_MARKUP)), limit_paise: limit, ...legal }
      : householdMandate({ opening_paise: 0, limit_paise: limit }, strategy, legal.legal_paise);
  return { mandate, strategy };
}

afterEach(() => vi.restoreAllMocks());

describe("hidden strategies", () => {
  it("draws every setting inside its tactic's range, for either side", () => {
    const random = seeded(1);
    for (let i = 0; i < JOBS; i++) {
      const role = i % 2 === 0 ? R.provider : R.requester;
      const tactic = pickTactic(random);
      const s = drawStrategy(role, tactic, random);
      const ranges = TACTIC_RANGES[tactic];
      expect(s.tactic).toBe(tactic);
      expect(within(s.opening, role === R.provider ? ranges.position : ranges.share)).toBe(true);
      expect(Number.isInteger(s.horizon) && within(s.horizon, ranges.horizon)).toBe(true);
      expect(within(s.closeness, ranges.closeness)).toBe(true);
      expect(s.concede).toHaveLength(MAX_ROUNDS - 2);
      for (const c of s.concede) expect(within(c, ranges.concede)).toBe(true);
    }
  });

  it("stays inside the ranges at the ends of the source, and never asks Math.random", () => {
    const random = vi.spyOn(Math, "random");
    for (const value of [0, 1 - Number.EPSILON, 1])
      for (const tactic of TACTICS) {
        const s = drawStrategy(R.provider, tactic, { next: () => value });
        expect(within(s.horizon, TACTIC_RANGES[tactic].horizon)).toBe(true);
        expect(within(s.opening, TACTIC_RANGES[tactic].position)).toBe(true);
      }
    expect(random).not.toHaveBeenCalled();
  });

  it("concedes from 0 at the opening to all of the way by the horizon, never back", () => {
    const random = seeded(2);
    for (let i = 0; i < JOBS; i++) {
      const s = drawStrategy(R.requester, pickTactic(random), random);
      expect(conceded(s, 1)).toBe(0);
      for (let round = 1; round <= MAX_ROUNDS + 1; round++)
        expect(conceded(s, round + 1)).toBeGreaterThanOrEqual(conceded(s, round));
      expect(conceded(s, s.horizon)).toBe(1);
    }
  });
});

describe("prices on a strategy, over thousands of seeded jobs", () => {
  it("never pass the limit or the legal minimum, are whole ₹10s, never move back, and reach the limit by the horizon", () => {
    const random = seeded(3);
    for (let i = 0; i < JOBS; i++) {
      const role = i % 2 === 0 ? R.provider : R.requester;
      const { mandate, strategy } = randomSide(role, random);
      const offers = [...curve(role, { mandate, strategy }), priceAt(role, mandate, MAX_ROUNDS + 1, strategy)];
      const { limit_paise: limit, legal_paise: legal = 0 } = mandate;
      offers.forEach((price, n) => {
        if (price !== limit) expect(price % PRICE_STEP_PAISE).toBe(0);
        if (role === R.provider) {
          expect(price).toBeGreaterThanOrEqual(Math.max(limit, legal));
          if (n > 0) expect(price).toBeLessThanOrEqual(offers[n - 1] as number);
        } else {
          expect(price).toBeLessThanOrEqual(limit);
          expect(price).toBeGreaterThanOrEqual(Math.min(limit, legal));
          if (n > 0) expect(price).toBeGreaterThanOrEqual(offers[n - 1] as number);
        }
      });
      // At the horizon: the limit itself, in whole ₹10s rounded the owner's way, and not below the law.
      const lawful = steps(Math.ceil, legal);
      const atLimit =
        role === R.provider
          ? Math.max(steps(Math.ceil, limit), lawful)
          : Math.min(limit, Math.max(steps(Math.floor, limit), lawful));
      expect(offers[strategy.horizon - 1]).toBe(atLimit);
    }
  });

  it("agree inside both limits or walk away, with at most MAX_ROUNDS offers a side", () => {
    const random = seeded(4);
    for (let i = 0; i < JOBS; i++) {
      const worker = randomSide(R.provider, random);
      const household = randomSide(R.requester, random);
      const end = haggle(worker, household);
      for (const role of [R.provider, R.requester])
        expect(end.offers.filter((o) => o.by === role).length).toBeLessThanOrEqual(MAX_ROUNDS);
      if (end.move === MoveKind.accept) {
        expect(end.price).toBeGreaterThanOrEqual(Math.max(worker.mandate.limit_paise, worker.mandate.legal_paise ?? 0));
        expect(end.price).toBeLessThanOrEqual(household.mandate.limit_paise);
      }
      // Limits that overlap by more than the rounding always meet.
      const room =
        household.mandate.limit_paise - Math.max(worker.mandate.limit_paise, worker.mandate.legal_paise ?? 0);
      if (room > PRICE_STEP_PAISE) expect(end.move).toBe(MoveKind.accept);
    }
  });

  it("settle the same two limits at different prices from job to job", () => {
    const random = seeded(5);
    const prices = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const ws = drawStrategy(R.provider, pickTactic(random), random);
      const hs = drawStrategy(R.requester, pickTactic(random), random);
      const worker = { mandate: { opening_paise: 90_000, limit_paise: 55_000 }, strategy: ws };
      const household = { mandate: householdMandate({ opening_paise: 0, limit_paise: 75_000 }, hs), strategy: hs };
      const end = haggle(worker, household);
      expect(end.move).toBe(MoveKind.accept);
      prices.add(end.price);
    }
    // On the old fixed curve every one of these jobs settled at the same price. Three offers each (ADR 0053 §4) leave
    // fewer steps to meet on than five did (over 20 then, 16 now), and still no price a counterpart can count on.
    expect(prices.size).toBeGreaterThan(12);
  });
});
