/**
 * Indian phone numbers in a job's own words, in any script people write digits in on Indian phones (ADR 0039 §3):
 * found and replaced once a job is settled, so a number typed into a need, an answer or a note goes with the contact
 * card. Pure and deliberately strict: a price, a date or a count of rooms is never taken for a number.
 */

/** Zero in each script with its own digits: ASCII, Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu,
 * Kannada, Malayalam. Each digit is one UTF-16 unit, so writing them as ASCII keeps every position in the text. */
const DIGIT_ZEROS = [0x30, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66] as const;
const BASE = 10;
/** What a removed number reads as, in every language. */
export const REMOVED_MARK = "···";

/** Runs of digits, once every script's digits are written as ASCII. */
const DIGIT_RUN = /\d+/g;
/** What may sit between the groups of one number: "98450 12345", "+91-98450-12345", "(080) 2345 6789". */
const JOINER = /^[\s.\-()/]{1,3}$/;
/** A plus or an opening bracket just before the first group belongs to the number, as does a closing one after it. */
const LEAD = /[+(]\s?$/;
const CLOSE = /^\)/;

/** Country and trunk prefixes, longest first, and the length of the number left once one is taken off. */
const NATIONAL_LENGTH = 10;
const PREFIXES = ["0091", "91", "0"] as const;
/** A mobile number starts 6 to 9; with a trunk or country prefix, a landline's area code starts 1 to 5. */
const MOBILE = /^[6-9]/;
const LANDLINE = /^[1-5]/;

/** Every script's digits as ASCII, position for position. */
function asciiDigitsKeepingPlace(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const zero = DIGIT_ZEROS.find((z) => code >= z && code < z + BASE);
    out += zero === undefined ? ch : String(code - zero);
  }
  return out;
}

/** Whether these digits, as written, are one Indian phone number: a mobile, or a landline written with its prefix. */
export function isIndianNumber(digits: string): boolean {
  if (digits.length === NATIONAL_LENGTH) return MOBILE.test(digits);
  const prefix = PREFIXES.find((p) => digits.startsWith(p) && digits.length === p.length + NATIONAL_LENGTH);
  if (!prefix) return false;
  const national = digits.slice(prefix.length);
  return MOBILE.test(national) || LANDLINE.test(national);
}

interface Group {
  start: number;
  end: number;
  digits: string;
}

/** Digit groups, chained while only a joiner separates them: each chain may hold one or more numbers. */
function chains(ascii: string): Group[][] {
  const out: Group[][] = [];
  for (const m of ascii.matchAll(DIGIT_RUN)) {
    const group = { start: m.index, end: m.index + m[0].length, digits: m[0] };
    const chain = out.at(-1);
    const last = chain?.at(-1);
    if (chain && last && JOINER.test(ascii.slice(last.end, group.start))) chain.push(group);
    else out.push([group]);
  }
  return out;
}

/** Where the numbers are in one chain, as [start, end) spans: the longest number from each group, left to right. */
function spansIn(chain: readonly Group[], ascii: string): [number, number][] {
  const spans: [number, number][] = [];
  let i = 0;
  while (i < chain.length) {
    let found = -1;
    let digits = "";
    for (let j = i; j < chain.length; j++) {
      digits += chain[j]?.digits ?? "";
      if (digits.length > PREFIXES[0].length + NATIONAL_LENGTH) break;
      if (isIndianNumber(digits)) found = j;
    }
    const first = chain[i];
    const last = chain[found];
    if (!first || !last) {
      i += 1;
      continue;
    }
    const lead = ascii.slice(0, first.start).match(LEAD)?.[0].length ?? 0;
    const close = CLOSE.test(ascii.slice(last.end)) ? 1 : 0;
    spans.push([first.start - lead, last.end + close]);
    i = found + 1;
  }
  return spans;
}

/** Where each phone number is in `text`, as [start, end) spans in order. */
export function phoneSpans(text: string): [number, number][] {
  const ascii = asciiDigitsKeepingPlace(text);
  return chains(ascii).flatMap((chain) => spansIn(chain, ascii));
}

/** The text with every phone number in it replaced by `REMOVED_MARK`; the same text when there is none. */
export function withoutPhones(text: string): string {
  const spans = phoneSpans(text);
  if (spans.length === 0) return text;
  let out = "";
  let at = 0;
  for (const [start, end] of spans) {
    out += text.slice(at, start) + REMOVED_MARK;
    at = end;
  }
  return out + text.slice(at);
}
