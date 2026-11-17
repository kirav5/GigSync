import { isTradeKind, Lang, Trade, WorkCategory, type WorkKind } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { TRADE_WORDS } from "../interview/lexicon.js";
import { distance, normalize, SPACE } from "../interview/normalize.js";
import { KIND_WORDS } from "./kind-words.js";
import { kindKey } from "./kinds.js";

/**
 * The kinds of work a worker's own words are closest to ("i sharpen wood" → Carpenter, "bal kaatna" → Barber), on the
 * phone and with no model, so the work step and the card chat can ask "Is this closest to Carpenter?" offline. Looser
 * than the lexicon on purpose: these are only ever offered as chips for the worker to pick, never taken, so a wrong
 * guess costs a glance (as Find's "Is this for…?" and ADR 0059's "Is this TV repair?").
 *
 * Each kind's words are its names in every language, the trade's word list and `KIND_WORDS`. A word typed counts for a
 * kind when it is one of that kind's words, give or take an ending ("wooden", "kaatna"), a doubled letter ("baal") or a
 * slip of a letter; a word many kinds share ("repair", "cleaning") counts for less than one only a single kind has.
 */

const ALL_KINDS: readonly WorkKind[] = [...Trade.options, ...WorkCategory.options];
const LIST_SEPARATOR = ",";
/** At most this many kinds are offered: more chips than this is the list again. */
export const MAX_CLOSEST = 3;
/** A word shared by more kinds than this says too little alone ("repair"); with another word it still counts. */
const MAX_SHARED = 5;
const MIN_SCORE = Math.log(ALL_KINDS.length / MAX_SHARED);
/** A kind this close to the best one's score is offered beside it. */
const NEAR_SHARE = 0.6;
/** Endings dropped from a Latin-letter word: English plurals and -ing, -er, -ed, and the Hinglish -na ("katna"). */
const ENDINGS = ["ing", "ers", "er", "ed", "es", "s", "na"] as const;
/** A word this short is matched only whole, never as the start of a longer one. */
const PREFIX_MIN = 3;
/** One word may be the start of another with at most this many letters more ("sharp", "sharpen"). */
const PREFIX_EXTRA = 3;
/** More in Hindi and Kannada letters, which count each vowel sign and join endings on (ಹೊಲಿ, ಹೊಲಿಯುವುದು). */
const PREFIX_EXTRA_INDIC = 6;
/** Words this long may have one letter wrong ("carpentar"). */
const SLIP_MIN = 5;
const LATIN = /^[a-z]+$/;
/** Hinglish writes a long vowel doubled or not ("baal", "bal"): runs of one letter are one letter. */
const REPEATS = /([a-z])\1+/g;

/** Words that only say it is work or who does it, in any of the languages: they point at no kind. */
const FILLER = new Set(
  "i, me, my, a, an, the, and, or, of, to, for, in, on, at, with, do, does, doing, am, is, are, make, making, fix, fixing, work, job, jobs, service, services, kaam, theek, thik, ka, ki, ke, ko, se, main, mai, mein, hoon, hun, hu, karta, karti, karte, karna, karne, aur, bhi, मैं, का, की, के, को, से, में, काम, करता, करती, करना, हूँ, हूं, और, भी, ठीक, सर्विस, ನಾನು, ಕೆಲಸ, ಮಾಡುತ್ತೇನೆ, ಮತ್ತು"
    .split(LIST_SEPARATOR)
    .map((w) => normalize(w)),
);

/** One spelling for a word: doubled letters as one, and a Latin word without its ending. */
function stem(word: string): string {
  if (!LATIN.test(word)) return word;
  const one = word.replace(REPEATS, "$1");
  const ending = ENDINGS.find((e) => one.endsWith(e) && one.length - e.length >= PREFIX_MIN);
  return ending ? one.slice(0, -ending.length) : one;
}

/** A text's words that may name work, each in its one spelling. */
const stems = (text: string): string[] =>
  normalize(text)
    .split(SPACE)
    .filter((w) => w && !FILLER.has(w))
    .map(stem);

const phrasesOf = (kind: WorkKind): string[] => [
  ...KIND_WORDS[kind].split(LIST_SEPARATOR),
  ...(isTradeKind(kind) ? TRADE_WORDS[kind] : []),
  ...Lang.options.map((l) => t(l, kindKey(kind))),
];

/** Each kind's words, and how many kinds share each word. */
const KIND_STEMS: ReadonlyMap<WorkKind, ReadonlySet<string>> = new Map(
  ALL_KINDS.map((kind) => [kind, new Set(phrasesOf(kind).flatMap(stems))] as const),
);
const SHARED = new Map<string, number>();
for (const words of KIND_STEMS.values()) for (const w of words) SHARED.set(w, (SHARED.get(w) ?? 0) + 1);

/** How much a kind's word says when it is heard: more the fewer kinds have it. */
const weight = (word: string): number => Math.log(ALL_KINDS.length / (SHARED.get(word) ?? ALL_KINDS.length));

/** Whether a word typed is a kind's word: the same, one the start of the other by an ending, or a letter off. */
function sameWord(said: string, word: string): boolean {
  if (said === word) return true;
  const [short, long] = said.length <= word.length ? [said, word] : [word, said];
  const extra = LATIN.test(short) ? PREFIX_EXTRA : PREFIX_EXTRA_INDIC;
  if (short.length >= PREFIX_MIN && long.startsWith(short) && long.length - short.length <= extra) return true;
  return short.length >= SLIP_MIN && Math.abs(long.length - short.length) <= 1 && distance(said, word) <= 1;
}

/** How much the words typed sound like one kind: each word's best match among the kind's words. */
function scoreOf(said: readonly string[], words: ReadonlySet<string>): number {
  let score = 0;
  for (const s of said) {
    let best = 0;
    for (const w of words) if (sameWord(s, w)) best = Math.max(best, weight(w));
    score += best;
  }
  return score;
}

/**
 * The kinds of work a worker's words are closest to, closest first, at most `MAX_CLOSEST`; none when no word points at
 * any kind clearly enough. Words in any of the app's languages and in Hinglish.
 */
export function closestKinds(text: string): WorkKind[] {
  const said = [...new Set(stems(text))];
  if (said.length === 0) return [];
  const scored = ALL_KINDS.map((kind) => ({ kind, score: scoreOf(said, KIND_STEMS.get(kind) ?? new Set()) }))
    .filter((k) => k.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  return scored
    .filter((k) => k.score >= top * NEAR_SHARE)
    .slice(0, MAX_CLOSEST)
    .map((k) => k.kind);
}
