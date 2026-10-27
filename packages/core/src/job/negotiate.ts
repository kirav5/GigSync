import { MAX_ROUNDS, Role } from "@gigsync/protocol";

/**
 * Deterministic price moves, after Collab's negotiator (market/negotiate.ts): each side opens at its own price and
 * concedes on a convex curve that reaches its private limit by the HORIZON-th offer. No model decides a price, and
 * the limit never leaves the phone: offers only ever move toward it.
 */

/** An owner's private price instruction, in paise. The worker opens high and will not go below `limit`; the consumer
 * opens low and will not go above it. */
export interface Mandate {
  opening_paise: number;
  limit_paise: number;
}

/** Offers are whole ₹10s, as people quote prices. */
export const PRICE_STEP_PAISE = 1000;
/** The offer number by which a side has conceded all the way to its limit. */
const HORIZON = 4;
/** Accept an acceptable offer this close to our own next one rather than haggle over the last few rupees. */
const CLOSE_ENOUGH = 0.05;

const R = Role.enum;
/** The worker sells (higher is better for them); the consumer buys (lower is better). */
const better = (role: Role, a: number, b: number) => (role === R.provider ? a >= b : a <= b);

/** The price this side offers in its `round`-th offer (1 = opening). Rounded in this side's favour, never past the
 * limit. */
export function priceAt(role: Role, m: Mandate, round: number): number {
  const t = Math.min(Math.max(round - 1, 0) / HORIZON, 1);
  const eased = 1 - (1 - t) ** 2;
  const raw = m.opening_paise + (m.limit_paise - m.opening_paise) * eased;
  const steps = raw / PRICE_STEP_PAISE;
  const rounded = (role === R.provider ? Math.ceil(steps) : Math.floor(steps)) * PRICE_STEP_PAISE;
  return better(role, rounded, m.limit_paise) ? rounded : m.limit_paise;
}

/** Within the owner's limit. */
export const acceptable = (role: Role, m: Mandate, price: number) => better(role, price, m.limit_paise);

export const MoveKind = { accept: "accept", offer: "offer", walk: "walk" } as const;
export type Move =
  | { kind: typeof MoveKind.accept }
  | { kind: typeof MoveKind.offer; price_paise: number; round: number }
  | { kind: typeof MoveKind.walk };

/**
 * This side's answer to the other side's offer, given how many offers it has made so far. Accepts an offer inside
 * the limit that is as good as, or close to, what it would offer next; otherwise concedes one step; walks away once
 * its rounds are used up.
 */
export function respond(role: Role, m: Mandate, offersMade: number, theirPrice: number): Move {
  const round = offersMade + 1;
  const next = priceAt(role, m, round);
  if (acceptable(role, m, theirPrice)) {
    if (better(role, theirPrice, next)) return { kind: MoveKind.accept };
    if (Math.abs(theirPrice - next) <= CLOSE_ENOUGH * next) return { kind: MoveKind.accept };
  }
  if (offersMade >= MAX_ROUNDS) return { kind: MoveKind.walk };
  return { kind: MoveKind.offer, price_paise: next, round };
}

/** A sane mandate: positive prices, and the opening on the right side of the limit. */
export function validMandate(role: Role, m: Mandate): boolean {
  return m.opening_paise > 0 && m.limit_paise > 0 && better(role, m.opening_paise, m.limit_paise);
}
