import type { Random } from "../src/index.js";

/** Mulberry32's increment and mixing constants. */
const INCREMENT = 0x6d2b79f5;
const MIX_A = 15;
const MIX_B = 7;
const MIX_C = 14;
const MIX_D = 61;
const UINT32 = 2 ** 32;

/**
 * A seeded source (Mulberry32) for tests and simulations: the same seed draws the same jobs, so a failure can be
 * replayed. Never on a phone: the app's source is cryptographic (apps/mobile/src/adapters/random.ts).
 */
export function seeded(seed: number): Random {
  let state = seed | 0;
  return {
    next() {
      state = (state + INCREMENT) | 0;
      let t = Math.imul(state ^ (state >>> MIX_A), 1 | state);
      t = (t + Math.imul(t ^ (t >>> MIX_B), MIX_D | t)) ^ t;
      return ((t ^ (t >>> MIX_C)) >>> 0) / UINT32;
    },
  };
}

/** Each phone in a test draws from its own seed, in the order the phones are made. */
let phones = 0;
export const nextPhoneRandom = (): Random => seeded(++phones);
