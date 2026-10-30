import { Lang } from "@gigsync/protocol";
import { normalize } from "../interview/normalize.js";
import { startsWord, type WordTest } from "../landing/ask-words.js";

const L = Lang.enum;

/**
 * What a worker says in Talk to offer help to people new to their city, or to stop: what people say, not what the app
 * shows. Offering needs both the people ("newcomers", "नए लोगों", "ಹೊಸಬರಿಗೆ") and helping, so "I'm new to Bengaluru, can
 * someone help me?" asks for help and is not an offer. Stopping is said with its own phrases. English counts in every
 * language, since owners mix it in; every entry matches at the start of a word, with any ending.
 */

/** Which of the two the owner said. */
export const HelpIntent = { offer: "offer", stop: "stop" } as const;
export type HelpIntent = (typeof HelpIntent)[keyof typeof HelpIntent];

/** The people helped: newcomers, said as the one helped (never "new to", which is how a newcomer speaks of herself). */
const NEWCOMERS: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["newcomer", "new people", "people new", "people moving", "people coming", "new arrivals", "others new"],
  [L.hi]: ["नए लोग", "नये लोग", "नए आए", "नये आए", "नए आने वाल", "नये आने वाल", "naye log"],
  [L.kn]: ["ಹೊಸಬರ", "ಹೊಸದಾಗಿ ಬಂದವರ", "ಹೊಸ ಜನರ", "ಹೊಸದಾಗಿ ಬರುವವರ"],
};
const HELPING: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["help", "guide", "show around", "mentor"],
  [L.hi]: ["मदद", "सहायता", "madad"],
  [L.kn]: ["ಸಹಾಯ", "ನೆರವ"],
};
/** Saying it plainly as a mentor: an offer without naming the people. */
const MENTORING: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["be a mentor", "become a mentor"],
  [L.hi]: ["मेंटर बन", "मेंटर बनना"],
  [L.kn]: ["ಮೆಂಟರ್ ಆಗ"],
};
const STOPPING: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["stop helping", "stop mentoring", "stop being a mentor", "no longer help", "don't want to help"],
  [L.hi]: ["मदद बंद", "मदद करना बंद", "मदद नहीं करनी", "मेंटर बनना बंद", "मेंटर नहीं रहना", "madad band"],
  [L.kn]: ["ಸಹಾಯ ನಿಲ್ಲಿಸ", "ಸಹಾಯ ಮಾಡುವುದನ್ನು ನಿಲ್ಲಿಸ", "ಸಹಾಯ ಮಾಡುವುದು ಬೇಡ", "ಮೆಂಟರ್ ಆಗಿರುವುದು ಬೇಡ"],
};

type Tests = Readonly<Record<Lang, readonly WordTest[]>>;
/** Each language's tests, with English added to the others. */
const byLang = (words: Readonly<Record<Lang, readonly string[]>>): Tests => ({
  [L.en]: words[L.en].map(startsWord),
  [L.hi]: [...words[L.en], ...words[L.hi]].map(startsWord),
  [L.kn]: [...words[L.en], ...words[L.kn]].map(startsWord),
});
const NEWCOMER_TESTS = byLang(NEWCOMERS);
const HELP_TESTS = byLang(HELPING);
const MENTOR_TESTS = byLang(MENTORING);
const STOP_TESTS = byLang(STOPPING);

const heard = (tests: Tests, lang: Lang, said: string) => tests[lang].some((test) => test(said));

/** Offering to help newcomers, or stopping, when the owner's words say so; undefined for anything else. */
export function helpIntent(text: string, lang: Lang): HelpIntent | undefined {
  const said = normalize(text);
  if (said.length === 0) return undefined;
  if (heard(STOP_TESTS, lang, said)) return HelpIntent.stop;
  const offer = (heard(NEWCOMER_TESTS, lang, said) && heard(HELP_TESTS, lang, said)) || heard(MENTOR_TESTS, lang, said);
  return offer ? HelpIntent.offer : undefined;
}
