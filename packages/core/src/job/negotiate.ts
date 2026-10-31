import { MAX_ROUNDS, Role } from "@gigsync/protocol";
import { conceded, type Strategy } from "./strategy.js";

/**
 * Price moves, after Collab's negotiator (market/negotiate.ts): each side opens at its own price and concedes toward
 * its private limit. How fast is set by the job's hidden strategy (job/strategy.ts, ADR 0033), drawn at random when
 * the job is first planned; a job planned before strategies keeps the old fixed curve, so a negotiation never changes
 * course halfway. No model decides a price, the limit never leaves the phone, and code keeps every bound here: never
 * past the limit, never below the legal minimum when it is known, in whole ₹10s, never back toward the opening.
 */

/** An owner's private price instruction, in paise. The worker opens high and will not go below `limit`; the consumer
 * opens low and will not go above it. */
export interface Mandate {
  opening_paise: number;
  limit_paise: number;
  /** The statutory minimum for this job, when known: no offer is below it, and the worker's agent accepts none. */
  legal_paise?: number;
}

/** Offers are whole ₹10s, as people quote prices. */
export const PRICE_STEP_PAISE = 1000;
/** The old fixed curve's offer by which a side has conceded all the way to its limit. */
const HORIZON = 4;
/** The old fixed curve: accept an acceptable offer this close to our own next one. */
const CLOSE_ENOUGH = 0.05;

const R = Role.enum;
/** The worker sells (higher is better for them); the consumer buys (lower is better). */
const better = (role: Role, a: number, b: number) => (role === R.provider ? a >= b : a <= b);

/** The old fixed curve, kept for jobs whose negotiation began before strategies: eased to the limit by HORIZON. */
function fixedCurve(round: number): number {
  const t = Math.min(Math.max(round - 1, 0) / HORIZON, 1);
  return 1 - (1 - t) ** 2;
}

/**
 * The price this side offers in its `round`-th offer (1 = opening), on the job's strategy when it has one. Rounded in
 * this side's favour, never below the legal minimum, never past the limit (for the household the limit wins: it never
 * offers more than its owner allowed).
 */
export function priceAt(role: Role, m: Mandate, round: number, s?: Strategy): number {
  const covered = s ? conceded(s, round) : fixedCurve(round);
  const raw = m.opening_paise + (m.limit_paise - m.opening_paise) * covered;
  const steps = raw / PRICE_STEP_PAISE;
  const rounded = (role === R.provider ? Math.ceil(steps) : Math.floor(steps)) * PRICE_STEP_PAISE;
  const legal = Math.ceil((m.legal_paise ?? 0) / PRICE_STEP_PAISE) * PRICE_STEP_PAISE;
  const lawful = Math.max(rounded, legal);
  return better(role, lawful, m.limit_paise) ? lawful : m.limit_paise;
}

/** Within the owner's limit; for the worker, also not below the legal minimum. */
export const acceptable = (role: Role, m: Mandate, price: number) =>
  better(role, price, m.limit_paise) && (role === R.requester || price >= (m.legal_paise ?? 0));

export const MoveKind = { accept: "accept", offer: "offer", walk: "walk" } as const;
export type Move =
  | { kind: typeof MoveKind.accept }
  | { kind: typeof MoveKind.offer; price_paise: number; round: number }
  | { kind: typeof MoveKind.walk };

/**
 * This side's answer to the other side's offer, given how many offers it has made so far. Accepts an offer inside
 * the limit that is as good as, or close to (the strategy's closeness), what it would offer next; otherwise concedes
 * one step; walks away once its rounds are used up.
 */
export function respond(role: Role, m: Mandate, offersMade: number, theirPrice: number, s?: Strategy): Move {
  const round = offersMade + 1;
  const next = priceAt(role, m, round, s);
  if (acceptable(role, m, theirPrice)) {
    if (better(role, theirPrice, next)) return { kind: MoveKind.accept };
    if (Math.abs(theirPrice - next) <= (s?.closeness ?? CLOSE_ENOUGH) * next) return { kind: MoveKind.accept };
  }
  if (offersMade >= MAX_ROUNDS) return { kind: MoveKind.walk };
  return { kind: MoveKind.offer, price_paise: next, round };
}

/** A sane mandate: positive prices, and the opening on the right side of the limit. */
export function validMandate(role: Role, m: Mandate): boolean {
  return m.opening_paise > 0 && m.limit_paise > 0 && better(role, m.opening_paise, m.limit_paise);
}
