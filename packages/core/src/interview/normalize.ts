/**
 * One spelling for every answer and every word-list entry, so a match does not depend on how a keyboard or a
 * recognizer wrote the words: composed Unicode, no zero-width joiners, no nukta (ज़ and ज are one letter to most
 * speakers, and recognizers disagree), chandrabindu as anusvara (हाँ and हां), lowercase Latin, punctuation as spaces.
 */

const ZERO_WIDTH = /[‌‍]/g;
const NUKTA = /़/g;
const CHANDRABINDU = /ँ/g;
const ANUSVARA = "ं";
/** Kannada "-ūvare", "and a half" joined to a number (ಎಂಟೂವರೆ, 8½). */
const KN_AND_A_HALF = /ೂವರೆ/g;
/** The number's own ending once "-ūvare" is taken off (ಎಂಟೂವರೆ → ಎಂಟು). */
const KN_U = "ು";
/** Stands after a number that was said "and a half", for the amount parser; no word list contains it. */
export const HALF_MARK = "½";
const APOSTROPHE = /['’]/g;
/** A point or comma that is not between two digits: "8.5" and "1,20,000" keep theirs. */
const LONE_POINT = /(?<!\p{Nd})[.,]|[.,](?!\p{Nd})/gu;
const PUNCTUATION = /[।॥?!;:"“”()[\]\-–—/]/g;
const SPACES = /\s+/g;
/** The one character `normalize` leaves between words. */
export const SPACE = " ";

export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(NUKTA, "")
    .replace(CHANDRABINDU, ANUSVARA)
    .replace(KN_AND_A_HALF, `${KN_U} ${HALF_MARK}`)
    .toLowerCase()
    .replace(APOSTROPHE, "")
    .replace(LONE_POINT, SPACE)
    .replace(PUNCTUATION, SPACE)
    .replace(SPACES, SPACE)
    .trim();
}

const LETTER = /[\p{L}\p{M}]/gu;
/** Entries this long match anywhere, even inside a longer word ("cook" in "cooking"); shorter ones only whole. */
const SUBSTRING_MIN = 4;
const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Where an entry first appears in a normalized text, or -1. */
export type Finder = (said: string) => number;

/**
 * Finds one word-list entry. Short entries (ac, एसी, नल, ना) need a boundary that is not a letter or a vowel sign on
 * either side, so "ना" is not found inside "खाना".
 */
export function finder(entry: string): Finder {
  const word = normalize(entry);
  if ((word.match(LETTER)?.length ?? 0) >= SUBSTRING_MIN) return (said) => said.indexOf(word);
  const whole = new RegExp(`(?<![\\p{L}\\p{M}])${word.replace(SPECIAL, "\\$&")}(?![\\p{L}\\p{M}])`, "u");
  return (said) => said.search(whole);
}

/** Where the first of several entries appears in a normalized text, or -1. */
export function firstIn(said: string, finders: readonly Finder[]): number {
  let first = -1;
  for (const find of finders) {
    const at = find(said);
    if (at >= 0 && (first < 0 || at < first)) first = at;
  }
  return first;
}

/** Edits (insert, delete, substitute) between two strings, by code point: how far a misspelling is from a name. */
export function distance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost);
    }
    row = next;
  }
  return row[y.length] ?? 0;
}
