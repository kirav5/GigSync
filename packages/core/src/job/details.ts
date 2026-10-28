import { DetailFlag } from "@gigsync/protocol";

/**
 * Reading the details a consumer gave (by key, from toggles and number pads in their app) without guessing at free
 * text. Two questions only: is this detail there at all, and what number does it hold.
 */

/** Zero in each script whose digits people type on Indian phones: ASCII, Devanagari, Kannada. */
const DIGIT_ZEROS = [0x30, 0x966, 0xce6] as const;
const DIGITS = /[0-9०-९೦-೯]+/;
const BASE = 10;

function digitValue(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  const zero = DIGIT_ZEROS.find((z) => code >= z && code < z + BASE) ?? 0;
  return code - zero;
}

/** The first whole number in a detail, in any of those scripts ("3", "३ लोग", "೩ ಜನ"); undefined if there is none. */
export function countIn(value: string | undefined): number | undefined {
  const run = value?.match(DIGITS)?.[0];
  if (!run) return undefined;
  return [...run].reduce((n, ch) => n * BASE + digitValue(ch), 0);
}

/**
 * A detail is present unless it is missing, empty, the app's "no", or a count of zero. Anything else counts, on
 * purpose: "a small dog" in any language should make the worker's agent ask the worker, not slip past a rule.
 */
export function present(value: string | undefined): boolean {
  const v = value?.trim();
  if (!v || v === DetailFlag.enum.no) return false;
  return countIn(v) !== 0;
}
