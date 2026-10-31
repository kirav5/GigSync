import { Lang } from "@gigsync/protocol";
import { normalize, SPACE } from "../interview/normalize.js";

const L = Lang.enum;

/**
 * Whose news the words are: "my brother is moving to Bengaluru" is about someone else, "I'm moving" or "moving to
 * Bengaluru next week" (no subject, as people say it) about the owner, and so is "moving with my wife". Cheap on
 * purpose: a person word below, not as company, and no word for "I" or "we". English counts in every language, since owners mix it in. English and Hindi words match whole;
 * Kannada adds case endings (ತಮ್ಮನಿಗೆ), so its people match at the start of a word, and its "I" also as the verb's
 * ending (ಹೋಗುತ್ತಿದ್ದೇನೆ, ಹೋಗ್ತಿದ್ದೀನಿ).
 */
const SELF: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["i", "i'm", "i've", "me", "we", "us"],
  [L.hi]: ["मैं", "मै", "हम", "मुझे", "हूँ", "हूं", "main", "mai", "hum", "mujhe", "hoon"],
  [L.kn]: ["ನಾನು", "ನಾವು", "ನನಗೆ", "ನಮಗೆ"],
};
const OTHERS: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: [
    "he",
    "she",
    "they",
    "his",
    "her",
    "their",
    "brother",
    "sister",
    "friend",
    "son",
    "daughter",
    "husband",
  ].concat(["wife", "cousin", "uncle", "aunt", "mother", "father", "mom", "dad", "neighbour", "neighbor", "someone"]),
  [L.hi]: ["वह", "वो", "वे", "उसका", "उसकी", "उनका", "भाई", "बहन", "दोस्त", "बेटा", "बेटी", "पति", "पत्नी", "bhai"].concat([
    "behen",
    "dost",
    "beta",
    "beti",
  ]),
  [L.kn]: ["ಅವನು", "ಅವಳು", "ಅವರು", "ಅಣ್ಣ", "ತಮ್ಮ", "ಅಕ್ಕ", "ತಂಗಿ", "ಸ್ನೇಹಿತ", "ಮಗ", "ಗಂಡ", "ಹೆಂಡತಿ"],
};
/** Someone going along is not someone else's news: "with my wife", "पत्नी के साथ", "ಹೆಂಡತಿಯ ಜೊತೆ" are left out. */
const COMPANION = /(?:\bwith (?:my |our )?\S+|\S+ (?:के|की) साथ|\S+ ಜೊತೆ\S*)/gu;
/** Kannada's first person as a verb ending: "-ೇನೆ" (formal) and "-ೀನಿ" (spoken). */
const KN_SELF_ENDING = /(ೇನೆ|ೀನಿ)$/u;

type Words = Readonly<Record<Lang, ReadonlySet<string>>>;
const sets = (words: Readonly<Record<Lang, readonly string[]>>): Words => ({
  [L.en]: new Set(words[L.en].map(normalize)),
  [L.hi]: new Set([...words[L.en], ...words[L.hi]].map(normalize)),
  [L.kn]: new Set([...words[L.en], ...words[L.kn]].map(normalize)),
});
const SELF_WORDS = sets(SELF);
const OTHER_WORDS = sets(OTHERS);
const KN_OTHERS = OTHERS[L.kn].map(normalize);

const isSelf = (word: string, lang: Lang) => SELF_WORDS[lang].has(word) || (lang === L.kn && KN_SELF_ENDING.test(word));
const isOther = (word: string, lang: Lang) =>
  OTHER_WORDS[lang].has(word) || (lang === L.kn && KN_OTHERS.some((w) => word.startsWith(w)));

/** True when the words are about someone else and never say "I" or "we". */
export function aboutSomeoneElse(text: string, lang: Lang): boolean {
  const words = normalize(text).replace(COMPANION, SPACE).split(SPACE);
  return words.some((w) => isOther(w, lang)) && !words.some((w) => isSelf(w, lang));
}
