import { Lang } from "@gigsync/protocol";
import { langOf } from "../job/guard.js";

/**
 * What the phone's reader reads (ADR 0065 §6): English only, until Hindi, Kannada, Hinglish and Kanglish are trained.
 * Hindi and Kannada show in their scripts; Hinglish and Kanglish are typed in English letters, so they are told by
 * their everyday words and Kannada's verb endings. Messages the reader does not read go to GigSync's model; with no
 * answer from it, the reader still tries Hinglish and Kanglish (its English reading beats the word lists), never Hindi
 * or Kannada in their scripts.
 */

/** Everyday Hindi and Kannada words typed in English letters, none of them an English word. */
const ROMAN_INDIC = new Set([
  // Hindi
  "hai",
  "hain",
  "mera",
  "meri",
  "mere",
  "mujhe",
  "humein",
  "hum",
  "chahiye",
  "chahie",
  "chaiye",
  "nahi",
  "nahin",
  "karna",
  "karo",
  "karwana",
  "karwani",
  "karwane",
  "silwana",
  "silwani",
  "banwana",
  "lagwana",
  "kar",
  "ka",
  "ki",
  "ke",
  "ko",
  "se",
  "mein",
  "aur",
  "kya",
  "kab",
  "kal",
  "abhi",
  "raha",
  "rahi",
  "rahe",
  "hoga",
  "ho",
  "gaya",
  "gayi",
  "bhi",
  "wala",
  "wali",
  "bhaiya",
  "ji",
  "ghar",
  "kitna",
  "paisa",
  "theek",
  "accha",
  "chalega",
  "kharab",
  "saaf",
  "safai",
  "kaam",
  "kaun",
  "bas",
  "ek",
  "haan",
  // Kannada
  "beku",
  "beda",
  "illa",
  "ide",
  "idhe",
  "maadi",
  "madi",
  "madbeku",
  "madisbeku",
  "madoru",
  "holisbeku",
  "nange",
  "nanage",
  "namge",
  "nanna",
  "namma",
  "nam",
  "mane",
  "manege",
  "maganige",
  "magalige",
  "alli",
  "agide",
  "aagide",
  "agtide",
  "aagtide",
  "aagta",
  "agta",
  "hogide",
  "murdide",
  "odedide",
  "kelsa",
  "yaavaga",
  "naale",
  "ninne",
  "inda",
  "ivattu",
  "swalpa",
  "banni",
  "bekagide",
  "kodi",
  "eshtu",
  "tumba",
  "kooda",
  "ondu",
  "eradu",
  "mooru",
  "matra",
  "namaskara",
  "saar",
]);
/** Kannada verbs take endings on English words too ("madisbeku", "aagtide"): these endings are not English. */
const KANNADA_ENDING = /(?:beku|bekku|agide|aagide|agtide|aagtide|odedide|murdide)$/;
/** A short message needs one such word ("bas ek", "ac service madisbeku"); a longer one two, as one may be a name. */
const SHORT_WORDS = 5;
const MIXED_MIN = 2;
const WORDS = /[a-z]+/g;

const indic = (word: string) => ROMAN_INDIC.has(word) || KANNADA_ENDING.test(word);

/** In English letters: what the reader may try when nothing else reads it, Hinglish and Kanglish included. */
export const inEnglishLetters = (text: string): boolean => langOf(text) === Lang.enum.en;

/** What the reader reads first: English, not Hinglish or Kanglish. */
export function readerReads(text: string): boolean {
  if (!inEnglishLetters(text)) return false;
  const words = text.toLowerCase().match(WORDS) ?? [];
  const mixed = words.filter(indic).length;
  return mixed < (words.length <= SHORT_WORDS ? 1 : MIXED_MIN);
}
