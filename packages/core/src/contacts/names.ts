/**
 * Matching a name the model wrote to one of the owner's contacts when the two are spelt differently: "Ravi" for
 * "रवि", "Meena" for "ಮೀನಾ", "Asha didi" for "Asha". Both are written in Latin letters first (Kannada letters sit in
 * their Unicode block in the same places as Devanagari's, so one table serves both), honorifics are set aside, and
 * spellings that sound alike are made equal. A close spelling counts only when exactly one contact is that close.
 */

/** Kannada's block starts this far after Devanagari's, letter for letter. */
const KANNADA_SHIFT = 0x0c80 - 0x0900;
const KANNADA_START = 0x0c80;
const KANNADA_END = 0x0cff;

const SPACE = " ";

/** Pairs of a letter and its Latin spelling, "क k ख kh", read into a table. */
const table = (pairs: string): Readonly<Record<string, string>> => {
  const parts = pairs.split(SPACE);
  return Object.fromEntries(parts.flatMap((part, i) => (i % 2 === 0 ? [[part, parts[i + 1] ?? ""]] : [])));
};

/** Devanagari consonants (and Kannada's, shifted), each with its inherent "a" left to the reader. */
const CONSONANTS = table(
  "क k ख kh ग g घ gh ङ n च ch छ chh ज j झ jh ञ n ट t ठ th ड d ढ dh ण n त t थ th द d ध dh न n प p फ ph ब b भ bh " +
    "म m य y र r ऱ r ल l ळ l ऴ l व v श sh ष sh स s ह h",
);
const VOWELS = table("अ a आ aa इ i ई ii उ u ऊ uu ऋ ri ऎ e ए e ऐ ai ऒ o ओ o औ au");
/** Vowel signs after a consonant, and the nasal and breath marks. */
const SIGNS = table("ा aa ि i ी ii ु u ू uu ृ ri ॆ e े e ै ai ॊ o ो o ौ au ं n ँ n ः h");
const VIRAMA = "्";
const NUKTA = "़";
const INHERENT = "a";

/** Words that say who someone is to the owner, not who they are: "Asha didi", "Amit bhaiya", "Sharma ji". */
const HONORIFICS = new Set([
  "di",
  "didi",
  "bhai",
  "bhaiya",
  "bhaiyya",
  "ji",
  "jee",
  "akka",
  "anna",
  "sir",
  "madam",
  "mam",
  "aunty",
  "anti",
  "uncle",
  "amma",
  "appa",
  "saab",
  "sahab",
  "avru",
  "avaru",
  "garu",
]);

/** Spellings that sound the same, made equal; applied in order. */
const SOUND_ALIKE: readonly [RegExp, string][] = [
  [/x/g, "ks"],
  [/ee|ii|ie|y(?=$)/g, "i"],
  [/oo|uu|ou/g, "u"],
  [/aa/g, "a"],
  [/w/g, "v"],
  [/z/g, "j"],
  [/q/g, "k"],
  [/ph|f/g, "p"],
  [/([bcdgjklmnprstvy])h/g, "$1"],
  [/(.)\1+/g, "$1"],
];
const NOT_LETTER = /[^a-z ]+/g;
const SPACES = /\s+/;
const VOWEL = /[aeiou]/g;
const CLOSE = 1;
/** Shorter than this, one letter's difference is a different name. */
const CLOSE_MIN_LENGTH = 4;

const toDevanagari = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return code >= KANNADA_START && code <= KANNADA_END ? String.fromCodePoint(code - KANNADA_SHIFT) : char;
};

/** Devanagari or Kannada in Latin letters, roughly as people type names; anything else passes through. */
export function romanize(text: string): string {
  const chars = [...text].map(toDevanagari).filter((c) => c !== NUKTA);
  let out = "";
  for (const [i, char] of chars.entries()) {
    const consonant = CONSONANTS[char];
    if (consonant === undefined) {
      out += VOWELS[char] ?? SIGNS[char] ?? (char === VIRAMA ? "" : char);
      continue;
    }
    const next = chars[i + 1] ?? "";
    const voweled = next === VIRAMA || SIGNS[next] !== undefined;
    out += voweled ? consonant : consonant + INHERENT;
  }
  return out;
}

/** A name as compared: Latin letters, honorifics gone, sound-alike spellings equal, no final "a" (Raj, Raja). */
export function nameKey(name: string): string {
  const words = romanize(name)
    .toLowerCase()
    .replace(NOT_LETTER, SPACE)
    .split(SPACES)
    .filter((w) => w && !HONORIFICS.has(w));
  let key = words.join("");
  for (const [pattern, to] of SOUND_ALIKE) key = key.replace(pattern, to);
  return key.endsWith(INHERENT) && key.length > 1 ? key.slice(0, -1) : key;
}

/** Letters to add, drop or change to turn one key into the other (Levenshtein). */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, swap);
    }
    row = next;
  }
  return row[b.length] ?? 0;
}

/** The one contact whose name passes `test`, or undefined when none or several do. */
function only(contacts: readonly string[], test: (contact: string) => boolean): string | undefined {
  const found = contacts.filter(test);
  return found.length === 1 ? found[0] : undefined;
}

/**
 * The contact `said` names, as the owner saved it: the same spelling, the same name in another script or spelling,
 * the same consonants, or one letter off; each looser step only when it points at a single contact.
 */
export function matchContact(said: string | null | undefined, contacts: readonly string[]): string | undefined {
  if (!said?.trim()) return undefined;
  const exact = contacts.find((c) => c.trim().toLowerCase() === said.trim().toLowerCase());
  if (exact) return exact;
  const key = nameKey(said);
  if (!key) return undefined;
  const skeleton = key.replace(VOWEL, "");
  return (
    only(contacts, (c) => nameKey(c) === key) ??
    only(contacts, (c) => skeleton.length > 1 && nameKey(c).replace(VOWEL, "") === skeleton) ??
    only(
      contacts,
      (c) => Math.max(key.length, nameKey(c).length) >= CLOSE_MIN_LENGTH && distance(key, nameKey(c)) <= CLOSE,
    )
  );
}

const WORD_BREAK = /[^\p{L}\p{M}]+/u;
/** Names run to two words ("Asha didi", "Sharma ji"); the message is searched in windows that long. */
const NAME_WORDS = 2;
/** A shorter name is not looked for at the start of longer words ("Ra" would be in everything). */
const PREFIX_MIN = 3;

/**
 * Whether the message names `contact`, in any script or spelling: some word or pair of words sounds the same, or
 * starts with the name, as Kannada adds case endings to it ("ಲಕ್ಷ್ಮಿಗೆ", to Lakshmi). No one-letter slack here: a
 * message naming Meena does not name Meera.
 */
export function namedIn(text: string, contact: string): boolean {
  const key = nameKey(contact);
  if (!key) return false;
  const words = text.split(WORD_BREAK).filter(Boolean);
  for (let size = 1; size <= NAME_WORDS; size++) {
    for (let i = 0; i + size <= words.length; i++) {
      const said = nameKey(words.slice(i, i + size).join(SPACE));
      if (said === key || (key.length >= PREFIX_MIN && said.startsWith(key))) return true;
    }
  }
  return false;
}
