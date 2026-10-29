import { Lang } from "@gigsync/protocol";
import { normalize } from "../interview/normalize.js";

const L = Lang.enum;

/**
 * What a worker says in Talk to ask what they earned: what people say, not what the app shows. Matched anywhere in
 * the words, so "how much did I earn this week?" and "इस हफ़्ते कितनी कमाई हुई" both count. English counts in every
 * language, since owners mix it in.
 */
const WORDS: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["earn", "earned", "earning", "earnings", "income", "how much money", "how much did i get"],
  [L.hi]: ["कमाई", "कमाया", "कमाए", "कमाये", "कितने पैसे", "कितना पैसा", "kamai", "kamaya", "kitne paise"],
  [L.kn]: ["ಸಂಪಾದನೆ", "ಸಂಪಾದಿಸಿ", "ಸಂಪಾದಿಸಿದೆ", "ದುಡಿಮೆ", "ಎಷ್ಟು ಹಣ", "ಎಷ್ಟು ದುಡ್ಡು"],
};

/** True when a worker's words in Talk ask what they earned, so Talk answers from the passbook on this phone. */
export function earningsIntent(text: string, lang: Lang): boolean {
  const said = normalize(text);
  if (said.length === 0) return false;
  const words = lang === L.en ? WORDS[L.en] : [...WORDS[L.en], ...WORDS[lang]];
  return words.some((w) => said.includes(normalize(w)));
}
