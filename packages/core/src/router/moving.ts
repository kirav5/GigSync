import { City, Lang } from "@gigsync/protocol";
import { normalize } from "../interview/normalize.js";
import { startsWord, type WordTest } from "../landing/ask-words.js";
import { aboutSomeoneElse } from "./speaker.js";

const L = Lang.enum;

/**
 * What a worker says in Talk when they are moving to a new city for work: what people say, not what the app shows.
 * Words that only mean moving ("shifting to", "नए शहर") count alone; everyday going words ("जा रहा हूँ", "going to")
 * count only with a city that has a guide named, since "मैं काम पर जा रहा हूँ" is just going to work. English counts in
 * every language, since owners mix it in. Every entry matches at the start of a word, with any ending (ಬೆಂಗಳೂರಿಗೆ).
 */
const MOVING: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["moving to", "move to", "shifting to", "shift to", "relocating", "new city", "moving city"],
  [L.hi]: ["नए शहर", "नये शहर", "शिफ्ट हो", "शिफ्ट कर", "naye shahar", "naye shehar", "shift ho"],
  [L.kn]: ["ಹೊಸ ಊರ", "ಹೊಸ ನಗರ", "ಶಿಫ್ಟ್"],
};
const GOING: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["going to", "coming to", "go to", "come to", "work in"],
  [L.hi]: ["जा रहा", "जा रही", "जाना है", "जाऊंगा", "जाऊंगी", "आ रहा", "आ रही", "ja raha", "ja rahi", "jana hai"],
  [L.kn]: ["ಹೋಗುತ್ತಿದ್ದೇನೆ", "ಹೋಗುತ್ತೇನೆ", "ಹೋಗಬೇಕು", "ಬರುತ್ತಿದ್ದೇನೆ", "ಬರುತ್ತೇನೆ", "ಹೋಗ್ತಿದ್ದೀನಿ"],
};
/** How each city with a guide is said and written, in any of the app's languages. */
const CITY_NAMES: Readonly<Record<City, readonly string[]>> = {
  bengaluru: ["bengaluru", "bangalore", "bengalooru", "बेंगलुरु", "बेंगलूरु", "बैंगलोर", "बंगलौर", "बेंगलोर", "ಬೆಂಗಳೂರು", "ಬೆಂಗಳೂರ"],
};

const tests = (words: readonly string[]): readonly WordTest[] => words.map(startsWord);
/** Each language's tests, with English added to the others. */
const byLang = (words: Readonly<Record<Lang, readonly string[]>>): Readonly<Record<Lang, readonly WordTest[]>> => ({
  [L.en]: tests(words[L.en]),
  [L.hi]: tests([...words[L.en], ...words[L.hi]]),
  [L.kn]: tests([...words[L.en], ...words[L.kn]]),
});
const MOVING_TESTS = byLang(MOVING);
const GOING_TESTS = byLang(GOING);
const CITY_TESTS = City.options.map((city) => ({ city, names: tests(CITY_NAMES[city]) }));

/** What Talk heard: the owner is moving, and to which city with a guide, when they named one. */
export interface MovingIntent {
  city?: City;
  /** Said with words that only mean moving ("shifting to", "नए शहर"), so it is heard even mid-interview. */
  certain: boolean;
}

/**
 * Moving to a new city, when the owner's words say so ("I'm moving to Bengaluru", "मैं बेंगलुरु जा रहा हूँ"), and not
 * when they are about someone else moving.
 */
export function movingIntent(text: string, lang: Lang): MovingIntent | undefined {
  const said = normalize(text);
  // "My brother is moving to Bengaluru" is news, not the owner's move.
  if (said.length === 0 || aboutSomeoneElse(text, lang)) return undefined;
  const city = CITY_TESTS.find(({ names }) => names.some((named) => named(said)))?.city;
  const moving = MOVING_TESTS[lang].some((heard) => heard(said));
  const going = city !== undefined && GOING_TESTS[lang].some((heard) => heard(said));
  if (!moving && !going) return undefined;
  return city ? { city, certain: moving } : { certain: moving };
}
