import { Lang } from "@gigsync/protocol";
import { tradesIn } from "../interview/lexicon.js";
import { normalize } from "../interview/normalize.js";

const L = Lang.enum;

/**
 * What a worker says in Talk when they want to hire someone: what people say, not what the app shows. English entries
 * match as whole words only ("hire", never "hired": "Priya hired me" is about the worker's own job). Hindi and Kannada
 * entries are stems that may take an ending (हेल्परों, ಸಹಾಯಕರು), but not one that joins their last letter into a
 * conjunct: ಸಹಾಯಕ್ಕೆ is "for the help", not "helper".
 */
const WHOLE_WORDS: readonly string[] = ["hire", "helper", "helpers", "need someone", "need somebody"];
const STEMS: Readonly<Record<Exclude<Lang, typeof L.en>, readonly string[]>> = {
  [L.hi]: [
    "हेल्पर",
    "हेल्पर्स",
    "मदद के लिए कोई",
    "मदद के लिए किसी",
    "किसी को रख",
    "काम पर रख",
    "kisi ko rakh",
    "kaam par rakh",
    "madad ke liye koi",
  ],
  [L.kn]: ["ಸಹಾಯಕ", "ಹೆಲ್ಪರ್", "ಕೆಲಸಕ್ಕೆ ಯಾರಾದರೂ", "ಕೆಲಸಕ್ಕೆ ಯಾರನ್ನಾದರೂ"],
};
/** "Need a …" asks to hire only when the next word or two name a helper or a trade ("need a good plumber"). */
const NEED_A = /(?<![\p{L}\p{M}])need an? ((?:\p{L}+ )?\p{L}+)/u;
const HELPER_NOUNS = new Set(["helper", "worker", "labourer", "assistant"]);

const SPECIAL = /[.*+?^${}()|[\]\\]/g;
const literal = (s: string) => normalize(s).replace(SPECIAL, "\\$&");
const BEFORE = "(?<![\\p{L}\\p{M}\\p{N}])";
const WHOLE_END = "(?![\\p{L}\\p{M}])";
/** Devanagari and Kannada viramas: after a stem they make its last letter part of a different word. */
const STEM_END = "(?![\\u094D\\u0CCD])";

const pattern = (entries: readonly string[], end: string) =>
  new RegExp(`${BEFORE}(?:${entries.map(literal).join("|")})${end}`, "u");
const WHOLE = pattern(WHOLE_WORDS, WHOLE_END);
const STEM_PATTERNS: Readonly<Record<Lang, RegExp | undefined>> = {
  [L.en]: undefined,
  [L.hi]: pattern(STEMS[L.hi], STEM_END),
  [L.kn]: pattern(STEMS[L.kn], STEM_END),
};

function needsHelper(said: string): boolean {
  const named = NEED_A.exec(said)?.[1];
  if (!named) return false;
  return named.split(" ").some((w) => HELPER_NOUNS.has(w)) || tradesIn(named).length > 0;
}

/**
 * True when a worker's words in Talk ask to hire someone ("मुझे कल एक हेल्पर चाहिए"), so Talk can open Find. English
 * words count in every language, since owners mix them in; the owner's own language adds its stems.
 */
export function hireIntent(text: string, lang: Lang): boolean {
  const said = normalize(text);
  if (said.length === 0) return false;
  return WHOLE.test(said) || (STEM_PATTERNS[lang]?.test(said) ?? false) || needsHelper(said);
}
