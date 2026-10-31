import { DetailFlag, QuestionKey } from "@gigsync/protocol";

/**
 * Reading the details a consumer gave (by key, from toggles and number pads in their app) without guessing at free
 * text. Two questions only: is this detail there at all, and what number does it hold.
 */

/** Zero in each script whose digits people type on Indian phones: ASCII, Devanagari, Kannada. */
const DIGIT_ZEROS = [0x30, 0x966, 0xce6] as const;
const DIGITS = /[0-9०-९೦-೯]+/;
const ALL_DIGITS = /[0-9०-९೦-೯]+/g;
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

/** The text with every Devanagari or Kannada digit written as a Western one: what people type, as forms expect it. */
export function asciiDigits(text: string): string {
  return text.replace(ALL_DIGITS, (run) => [...run].map((ch) => String(digitValue(ch))).join(""));
}

/** Every whole number in a text, in any of those scripts, as values: "₹9,500 at 7" gives [9, 500, 7]. */
export function numbersIn(text: string): number[] {
  return (text.match(ALL_DIGITS) ?? []).map((run) => countIn(run) as number);
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

/** Questions the consumer's app answers with a yes-or-no toggle, writing a `DetailFlag`, never typed text. */
export const YES_NO_QUESTIONS: ReadonlySet<QuestionKey> = new Set([
  QuestionKey.enum.pets,
  QuestionKey.enum.labour_only,
]);

/**
 * The yes-or-no details a worker may ask to see a request for before any quote (pets). Who buys the paint is not one:
 * it changes the price, not whether the worker takes the job.
 */
export const ASK_FIRST_DETAILS: ReadonlySet<QuestionKey> = new Set([QuestionKey.enum.pets]);
