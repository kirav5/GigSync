import { Lang } from "@gigsync/protocol";
import { langOf } from "../job/guard.js";

/**
 * What the phone's reader reads (ADR 0065 §6, amended 2026-11-14): English and Hinglish, which it is trained on, never
 * through a generative model. Hindi and Kannada show in their scripts; Kanglish is typed in English letters, so it is told
 * by its everyday words and Kannada's verb endings. Messages the reader does not read go to the generative model, when the
 * app has one; with no answer from it, the reader still tries Kanglish (its reading beats the word lists), never Hindi or Kannada in their
 * scripts.
 */

/** Everyday Kannada words typed in English letters, none of them an English or a Hindi word. */
const KANNADA_WORDS = new Set([
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
/** A short message needs one such word ("ac service madisbeku"); a longer one two, as one may be a name. */
const SHORT_WORDS = 5;
const MIXED_MIN = 2;
const WORDS = /[a-z]+/g;

const kannada = (word: string) => KANNADA_WORDS.has(word) || KANNADA_ENDING.test(word);

/** In English letters: what the reader may try when nothing else reads it, Kanglish included. */
export const inEnglishLetters = (text: string): boolean => langOf(text) === Lang.enum.en;

/** What the reader reads first, and alone: English and Hinglish, not Kanglish. */
export function readerReads(text: string): boolean {
  if (!inEnglishLetters(text)) return false;
  const words = text.toLowerCase().match(WORDS) ?? [];
  const mixed = words.filter(kannada).length;
  return mixed < (words.length <= SHORT_WORDS ? 1 : MIXED_MIN);
}
