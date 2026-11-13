// The languages a run's messages are written in (ADR 0065 §6): each with its phrases for the details and the line the
// writing prompt says it in. A run is one language, kept in its run.json, so its targets are drawn again the same way.

import * as english from "./phrases.mjs";
import * as hinglish from "./phrases-hinglish.mjs";

export const ReaderLang = { en: "en", hinglish: "hinglish" };

const ENGLISH_LINE = "English only.";

/** Each language's phrases: kinds of work, places, times, how long, styles, and how the prompt names the language. */
export const PHRASES = {
  [ReaderLang.en]: { ...english, LANGUAGE_LINE: ENGLISH_LINE },
  [ReaderLang.hinglish]: { ...hinglish, GROUP_WORDS: english.GROUP_WORDS },
};

/** A run's language from its settings; English when it says none, as runs before Hinglish do. */
export function langOf(value) {
  const lang = value ?? ReaderLang.en;
  if (!(lang in PHRASES)) throw new Error(`--lang must be one of ${Object.keys(PHRASES).join(", ")}`);
  return lang;
}

/** Every language's words for the kinds of work, for telling whether a message names one. */
export const ALL_KIND_WORDS = [...new Set(Object.values(PHRASES).flatMap((p) => p.KINDS.flatMap((k) => k.words)))];
