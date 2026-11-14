// What a Hinglish target's details may say (ADR 0065 §6): Hindi typed in English letters, mixed with English, as
// households in the pilot type on WhatsApp. The words are a person's, never the app's: kinds of work keep their English
// names beside the Hindi ones people use, and places stay as the city spells them, with "ke paas" for a landmark. The
// same look-alike pairs as in English: "agle mahine" is when, "mahine ke liye" is how long.
import { protocol } from "./core.mjs";
import { KINDS as ENGLISH_KINDS, WHERE as ENGLISH_WHERE } from "./phrases.mjs";

/** How people name the trades in Hinglish, beside the English names they use as often. */
const TRADE_WORDS = {
  maid: ["bai", "kaamwali", "kaamwali bai", "maid", "jhadu pocha wali", "safai wali"],
  cook: ["cook", "khana banane wali", "khana banane wala", "rasoiya", "maharaj", "cook didi"],
  driver: ["driver", "gaadi chalane wala", "driver bhaiya"],
  electrician: ["electrician", "bijli wala", "wireman", "light wala"],
  plumber: ["plumber", "nal wala", "plumber bhaiya"],
  carpenter: ["carpenter", "badhai", "mistri", "furniture wala"],
  ac_technician: ["AC wala", "AC mechanic", "AC service wala", "AC repair"],
  painter: ["painter", "rang wala", "painting ka kaam", "putai wala"],
};

/** Every kind of work: the English words (Hinglish names most work in English), and the trades' Hindi words too. */
export const KINDS = ENGLISH_KINDS.map((k) => ({
  kind: k.kind,
  words: [...new Set([...k.words, ...(TRADE_WORDS[k.kind] ?? [])])],
}));

/** Places as the city spells them, and landmarks said the Hindi way. */
export const WHERE = [
  ...ENGLISH_WHERE,
  "HSR ke paas",
  "Forum Mall ke paas",
  "Silk Board ke paas",
  "Indiranagar metro ke paas",
];

/** Days and times. "agle hafte se" and "subah" are when the work starts, never how long. */
export const WHEN = [
  "kal",
  "aaj",
  "kal subah",
  "aaj shaam",
  "parso",
  "abhi",
  "jaldi",
  "turant",
  "somvar ko",
  "sunday ko",
  "weekend pe",
  "agle hafte se",
  "10 baje",
  "5 baje ke baad",
  "aaj 6 baje tak",
  "15 tarikh ko",
  "subah",
  "shaam ko",
  "1 tarikh se",
  "agle mahine",
  "kal dopahar",
];

const A = protocol.Arrangement.enum;

/** How the work is hired, by arrangement: how often and for how long, never when it starts. */
export const HOW_LONG = {
  [A.hourly]: ["2 ghante ke liye", "kuch ghanton ke liye", "3 ghante", "ghante ke hisaab se"],
  [A.visit]: ["ek baar", "sirf ek din", "ek din ke liye", "ek baar ka kaam"],
  [A.weekly]: ["hafte mein 3 din", "hafte mein do baar", "sirf weekend pe", "ek din chhod ke"],
  [A.monthly]: ["mahine ke liye", "roz", "rozana", "har din", "full time", "monthly"],
};

/** How the message is written. Spelling varies anywhere except in the words a detail is marked by. */
export const STYLES = [
  "WhatsApp Hinglish, all lower case, no punctuation",
  "polite Hinglish, with 'ji' or 'please'",
  "curt Hinglish, as few words as possible",
  "Hinglish with loose spellings like 'chaiye' or 'krna', but only in words you were not given",
  "chatty Hinglish, with one short sentence about the household",
  "mostly English with a few Hindi words",
  "mostly Hindi in English letters with a few English words",
];

/**
 * For a message that only says what is wrong: the Hindi words households use for the things one kind of work deals
 * with, so the reader learns that "pankha" wants an electrician as "fan" does. Only the target's own kind's words: given
 * a list for every kind, the writer put fans and taps into a bike's problem.
 */
const PROBLEM_WORDS = {
  electrician: ["pankha", "batti", "bijli", "switch board", "taar", "socket"],
  plumber: ["nal", "tanki", "motor", "naali", "flush", "pipe"],
  carpenter: ["darwaza", "khidki", "almari", "kundi", "palang", "kursi", "mez"],
  painter: ["deewar", "rang", "putai", "kamra"],
  waterproofing: ["chhat", "seelan", "deewar", "baarish ka pani"],
  pest_control: ["keede", "deemak", "chuhe", "machhar", "cockroach", "khatmal"],
  maid: ["jhadu", "pocha", "bartan", "kapde", "safai"],
  cook: ["khana", "roti", "sabzi", "nashta", "tiffin"],
  driver: ["gaadi", "office", "school"],
  gardener: ["paudhe", "gamle", "ghaas", "bagicha"],
  car_wash: ["gaadi", "car", "dhulai"],
  locksmith: ["taala", "chaabi", "kundi"],
  mason: ["deewar", "farsh", "plaster", "eent"],
  tile_work: ["tiles", "farsh", "bathroom"],
  geyser_repair: ["geyser", "garam pani"],
  water_tank_cleaning: ["tanki", "pani"],
  tailor: ["kurta", "blouse", "silai", "fitting"],
  laundry: ["kapde", "dhulai", "press"],
  priest: ["pooja", "havan", "griha pravesh"],
};

/** The writing prompt's line for a problem of this kind of work; none when the kind has no Hindi words of its own. */
export function problemLine(kind) {
  const words = PROBLEM_WORDS[kind];
  if (!words) return undefined;
  return `Where it fits, say a thing the Hindi way people do, such as ${words.join(", ")}: one or two at most, and only what fits this problem.`;
}

/** For the writing prompt: what the message's language is. */
export const LANGUAGE_LINE = [
  "Hinglish: Hindi typed in English letters, mixed with English words, as people type on WhatsApp in an Indian city. Never Devanagari.",
  "Write every detail's given words exactly as given, never respelled or shortened, even in a loose style.",
].join(" ");
