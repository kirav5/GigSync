import type { Random } from "@gigsync/core";

/** 2^32: one draw of a 32-bit word, scaled to [0, 1). */
const UINT32 = 2 ** 32;

/**
 * The phone's random source for each job's hidden negotiation settings (ADR 0033): the platform's cryptographic
 * generator, so nobody can predict a job's opening or curve from the app's code or from earlier jobs. Never
 * `Math.random`, whose output can be worked out from a few values.
 */
export const cryptoRandom: Random = {
  next() {
    const word = new Uint32Array(1);
    crypto.getRandomValues(word);
    return (word[0] as number) / UINT32;
  },
};
