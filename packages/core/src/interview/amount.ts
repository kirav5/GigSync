import { PAISE_PER_RUPEE } from "@gigsync/protocol";
import { asciiDigits } from "../job/details.js";
import { HALF_MARK, normalize, SPACE } from "./normalize.js";
import { EN_NUMBERS } from "./numbers-en.js";
import { HI_NUMBERS } from "./numbers-hi.js";
import { KN_NUMBERS } from "./numbers-kn.js";

/**
 * Amounts as people say and type them, without a model: digits in any script ("७०००", "7,000", "₹7000", "7k"), number
 * words in Hindi, Kannada and English ("साढ़े आठ हज़ार", "ಎಂಟು ಸಾವಿರದ ಐನೂರು", "nine thousand five hundred"), and the
 * two mixed ("साढ़े 8 हज़ार"). Spoken amounts are where a mishearing costs money, so the interview reads every one back.
 */

/** One language's number words, as written; each is normalized when the parser loads. */
export interface NumberWords {
  /** Numbers said as one word. */
  values: Readonly<Record<string, number>>;
  /** Words that multiply what came before them: hundred, thousand, lakh. */
  multipliers: Readonly<Record<string, number>>;
  /** Words that change the number after them: साढ़े +½, सवा +¼, पौने −¼. */
  prefixes?: Readonly<Record<string, number>>;
}

const TABLES = [EN_NUMBERS, HI_NUMBERS, KN_NUMBERS];
const load = (pick: (w: NumberWords) => Readonly<Record<string, number>> | undefined) =>
  new Map(TABLES.flatMap((w) => Object.entries(pick(w) ?? {})).map(([word, n]) => [normalize(word), n]));
const VALUES = load((w) => w.values);
const MULTIPLIERS = load((w) => w.multipliers);
const PREFIXES = load((w) => w.prefixes);
/** Longest first, to split a multiplier off a word it was typed onto ("ಎಂಟುಸಾವಿರ"). */
const JOINED = [...MULTIPLIERS.keys()].sort((a, b) => b.length - a.length);
/** Currency words, dropped wherever they stand. */
const CURRENCY = new Set(
  ["rs", "rupees", "rupee", "rupaye", "रुपये", "रुपए", "रुपया", "रु", "ರೂಪಾಯಿ", "ರೂ"].map((w) => normalize(w)),
);
/** Words that may join two parts of one amount ("nine thousand and five hundred"). */
const CONNECTORS = new Set(["and", "और", "ಮತ್ತು"].map((w) => normalize(w)));
/** "k" alone is a multiplier only straight after a number. */
const K = normalize("k");
const THOUSAND = 1000;
const HALF = 0.5;
const BASE = 10;
/** A lone small number ("एक बार", "1 visit") is rarely the amount; a later, larger one wins over it. */
const STRONG_MIN = 10;

const GROUPING = /(?<=\d),(?=\d)/g;
const AND_A_HALF = /(?<!\p{L})and a half(?!\p{L})/gu;
const NOT_WORD = /[^\p{L}\p{M}\d.½\s]/gu;
const DIGIT_LETTER = /(\d)(?=[\p{L}\p{M}½])/gu;
const LETTER_DIGIT = /([\p{L}\p{M}½])(?=\d)/gu;
const NUMBER = /^\d+(?:\.\d+)?$/;

const Kind = { value: "value", digits: "digits", multiplier: "multiplier", prefix: "prefix", half: "half" } as const;
type Kind = (typeof Kind)[keyof typeof Kind];
interface Token {
  kind: Kind | undefined;
  n: number;
  word: string;
}

/** "ಎಂಟುಸಾವಿರ" as "ಎಂಟು ಸಾವಿರ"; anything else as it is. */
function splitJoined(word: string): string[] {
  if (VALUES.has(word) || MULTIPLIERS.has(word)) return [word];
  const tail = JOINED.find((m) => word.length > m.length && word.endsWith(m) && VALUES.has(word.slice(0, -m.length)));
  return tail ? [word.slice(0, -tail.length), tail] : [word];
}

function classify(word: string): Token {
  if (word === HALF_MARK) return { kind: Kind.half, n: HALF, word };
  if (NUMBER.test(word)) return { kind: Kind.digits, n: Number(word), word };
  for (const [kind, table] of [
    [Kind.value, VALUES],
    [Kind.multiplier, MULTIPLIERS],
    [Kind.prefix, PREFIXES],
  ] as const) {
    const n = table.get(word);
    if (n !== undefined) return { kind, n, word };
  }
  return { kind: undefined, n: 0, word };
}

function tokens(text: string): Token[] {
  return asciiDigits(normalize(text))
    .replace(GROUPING, "")
    .replace(AND_A_HALF, ` ${HALF_MARK} `)
    .replace(NOT_WORD, SPACE)
    .replace(DIGIT_LETTER, "$1 ")
    .replace(LETTER_DIGIT, "$1 ")
    .split(SPACE)
    .filter((w) => w && !CURRENCY.has(w))
    .flatMap(splitJoined)
    .map(classify);
}

/** The largest number that can still be added after a word number: "twenty" takes a unit, "ಐನೂರು" takes up to 99. */
function room(n: number): number {
  if (!Number.isInteger(n) || n === 0) return 1;
  let place = 1;
  while (n % (place * BASE) === 0) place *= BASE;
  return place;
}

/** Whether `next` can carry on the amount `prev` belongs to, rather than start another. */
function follows(prev: Token | undefined, next: Token): boolean {
  if (!prev || prev.kind === Kind.multiplier || prev.kind === Kind.prefix || prev.kind === undefined) return true;
  return prev.kind === Kind.value && next.kind === Kind.value && next.n < room(prev.n);
}

interface Run {
  rupees: number;
  strong: boolean;
  end: number;
}

/** One amount starting at `from`, read until a word that cannot be part of it. */
function readRun(list: readonly Token[], from: number): Run {
  let total = 0;
  let current = 0;
  let delta = 0;
  let strong = false;
  let prev: Token | undefined;
  let at = from;
  for (; at < list.length; at++) {
    const tok = list[at] as Token;
    if (tok.kind === Kind.value || tok.kind === Kind.digits) {
      if (!follows(prev, tok)) break;
      current += tok.n + delta;
      strong ||= tok.n >= STRONG_MIN || delta !== 0;
      delta = 0;
    } else if (tok.kind === Kind.half) {
      if (prev?.kind !== Kind.value && prev?.kind !== Kind.digits) break;
      current += tok.n;
      strong = true;
    } else if (tok.kind === Kind.prefix) {
      if (prev && prev.kind !== Kind.multiplier && prev.kind !== undefined) break;
      delta = tok.n;
    } else if (tok.kind === Kind.multiplier) {
      if (!prev && tok.word === K) break;
      const base = current > 0 ? current : 1 + delta;
      if (tok.n < THOUSAND) current = base * tok.n;
      else [total, current] = [total + base * tok.n, 0];
      delta = 0;
      strong = true;
    } else if (prev && CONNECTORS.has(tok.word) && list[at + 1]?.kind !== undefined) {
      // "and" between two parts: keep reading, but it is not a number itself.
    } else break;
    prev = tok;
  }
  return { rupees: total + current, strong, end: Math.max(at, from + 1) };
}

/**
 * The first amount in the text, in paise. A lone small number is passed over when a real amount follows it
 * ("एक बार का पाँच सौ" is ₹500, not ₹1). Undefined when there is no number at all.
 */
export function parseAmount(text: string): number | undefined {
  const list = tokens(text);
  let first: Run | undefined;
  for (let at = 0; at < list.length; ) {
    const tok = list[at] as Token;
    const starts =
      tok.kind !== undefined && tok.kind !== Kind.half && !(tok.kind === Kind.multiplier && tok.word === K);
    if (!starts) {
      at++;
      continue;
    }
    const run = readRun(list, at);
    if (run.strong) return Math.round(run.rupees * PAISE_PER_RUPEE);
    first ??= run;
    at = run.end;
  }
  return first ? Math.round(first.rupees * PAISE_PER_RUPEE) : undefined;
}
