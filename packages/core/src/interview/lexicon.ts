import { Lang, MAX_TRADES, Trade } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import type { AreaChoice, Slot } from "./card.js";
import { distance, type Finder, finder, firstIn, normalize, SPACE } from "./normalize.js";

/**
 * Word lists for the card interview, in the three scripts plus Hinglish, so answers are understood without a model.
 * These are what people say, not what the app shows: the catalogs are for showing. Each entry is normalized when it
 * loads; entries of four letters or more match inside longer words, shorter ones only as whole words.
 */

const T = Trade.enum;
const L = Lang.enum;

const TRADE_WORDS: Readonly<Record<Trade, readonly string[]>> = {
  [T.cook]: [
    "cook",
    "cooking",
    "chef",
    "khana",
    "khaana",
    "खाना बना",
    "रसोइया",
    "रसोई",
    "कुक",
    "ಅಡುಗೆ",
    "ಅಡಿಗೆ",
    "ಕುಕ್",
    "ಬಾಣಸಿಗ",
  ],
  [T.maid]: [
    "maid",
    "housework",
    "house work",
    "cleaning",
    "jhadu",
    "pocha",
    "bartan",
    "safai",
    "ghar ka kaam",
    "घर का काम",
    "घरेलू",
    "कामवाली",
    "झाड़ू",
    "पोछा",
    "पोंछा",
    "बर्तन",
    "सफ़ाई",
    "मेड",
    "ಮನೆಗೆಲಸ",
    "ಮನೆ ಕೆಲಸ",
    "ಕಸ",
    "ಪಾತ್ರೆ",
    "ಕ್ಲೀನಿಂಗ್",
  ],
  [T.electrician]: [
    "electrician",
    "electric",
    "wiring",
    "bijli",
    "बिजली",
    "इलेक्ट्रीशियन",
    "वायरिंग",
    "ಎಲೆಕ್ಟ್ರಿಷಿಯನ್",
    "ಕರೆಂಟ್",
    "ವೈರಿಂಗ್",
  ],
  [T.plumber]: ["plumber", "plumbing", "pipe", "nal", "प्लंबर", "नल", "पाइप", "ಪ್ಲಂಬರ್", "ನಲ್ಲಿ", "ಪೈಪ್"],
  [T.carpenter]: ["carpenter", "furniture", "lakdi", "बढ़ई", "कारपेंटर", "लकड़ी", "ಬಡಗಿ", "ಕಾರ್ಪೆಂಟರ್"],
  [T.ac_technician]: ["ac", "air conditioner", "एसी", "ए सी", "ಎಸಿ", "ಏಸಿ"],
  [T.painter]: ["painter", "painting", "putai", "पेंटर", "पुताई", "रंगाई", "ಪೇಂಟರ್", "ಬಣ್ಣ"],
  [T.driver]: ["driver", "driving", "ड्राइवर", "गाड़ी चला", "ಡ್ರೈವರ್", "ಚಾಲಕ"],
};

const YES = ["yes", "yeah", "yep", "ok", "okay", "sure", "haan", "han", "ji", "theek"]
  .concat(["हाँ", "जी", "ठीक है", "सही", "बिल्कुल", "कर दो"])
  .concat(["ಹೌದು", "ಹೂಂ", "ಹಾಂ", "ಸರಿ", "ಆಯ್ತು", "ಓಕೆ", "ಆಗಲಿ"]);
/** Any of these wins over a yes: "हाँ, नहीं" is a no. */
const NO = ["no", "nope", "not", "nah", "nahi", "nahin", "mat", "dont"]
  .concat(["नहीं", "नही", "मत", "रहने दो"])
  .concat(["ಇಲ್ಲ", "ಬೇಡ", "ಬೇಡಿ", "ಬೇಡಾ"]);
/** ना means no only as the whole answer or its first word; elsewhere it is emphasis ("कर दो ना" is a yes). */
const NA = normalize("ना");
const SKIP = ["skip", "nothing", "छोड़ो", "छोड़ें", "छोड़ दो", "कुछ नहीं", "ಬಿಡಿ", "ಏನೂ ಇಲ್ಲ", "ಏನೂ ಬೇಡ"];
/** An answer this short with a skip word in it means skip; a longer one is the line itself. */
const SKIP_MAX_WORDS = 3;
const NONE = ["none", "no other", "nothing", "कोई नहीं", "और कोई नहीं", "ಯಾವುದೂ ಇಲ್ಲ", "ಬೇರೆ ಇಲ್ಲ"];
const LANG_WORDS: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["english", "angrezi", "इंग्लिश", "अंग्रेज़ी", "ಇಂಗ್ಲಿಷ್"],
  [L.hi]: ["hindi", "हिंदी", "हिन्दी", "ಹಿಂದಿ"],
  [L.kn]: ["kannada", "कन्नड़", "ಕನ್ನಡ"],
};

/** A field of the card an owner can ask to change, by voice or a chip. */
export type Field = Exclude<Slot, "ask_first" | "confirm" | "done" | "arrangements" | "more_rates">;

/** Words naming each field, most specific first ("minimum rate" is the minimum, not the rate). */
const FIELD_WORDS: Readonly<Record<Field, readonly string[]>> = {
  min: ["minimum", "lowest", "least", "सबसे कम", "कम से कम", "ಕನಿಷ್ಠ"],
  rate: ["rate", "price", "दाम", "रेट", "पैसे", "ದರ", "ದರವನ್ನು", "ಬೆಲೆ"],
  area: ["area", "इलाक़ा", "जगह", "एरिया", "ಏರಿಯಾ", "ಜಾಗ", "ಜಾಗವನ್ನು"],
  trade: ["work", "trade", "काम", "ಕೆಲಸ"],
  languages: ["language", "भाषा", "ಭಾಷೆ"],
  about: ["about", "बारे में", "ಬಗ್ಗೆ"],
  auto: ["sign", "दस्तख़त", "सौदा", "ಸಹಿ"],
};
const CHANGE = ["change", "update", "edit", "badal", "badlo", "बदल", "बदलो", "बदलना", "बदलें", "बदलिए"].concat([
  "ಬದಲಾಯಿಸು",
  "ಬದಲಿಸಿ",
  "ಬದಲಾಯಿಸಿ",
  "ಬದಲಿಸು",
]);

const finders = (words: readonly string[]): Finder[] => words.map(finder);
/** Each trade's words, plus its name in every language's catalog ("कुक", "ಅಡುಗೆಯವರು"). */
const TRADES = Trade.options.map(
  (tr) => [tr, finders([...TRADE_WORDS[tr], ...Lang.options.map((l) => t(l, `trade.${tr}`))])] as const,
);
const LANGS = Lang.options.map(
  (lang) => [lang, finders([...LANG_WORDS[lang], ...Lang.options.map((l) => t(l, `lang.${lang}`))])] as const,
);
const FIELDS = (Object.keys(FIELD_WORDS) as Field[]).map((field) => [field, finders(FIELD_WORDS[field])] as const);
const YES_FINDERS = finders(YES);
const NO_FINDERS = finders(NO);
const SKIP_FINDERS = finders(SKIP);
const NONE_FINDERS = finders(NONE);
const CHANGE_FINDERS = finders(CHANGE);

/** The items whose words appear in the text, in the order they were said. */
function named<V>(said: string, table: readonly (readonly [V, readonly Finder[]])[]): V[] {
  return table
    .map(([value, list]) => [value, firstIn(said, list)] as const)
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([value]) => value);
}

/** The trades in an answer, as said: "मैं खाना बनाती हूँ" is cook; several are allowed, up to the board's limit. */
export const tradesIn = (text: string): Trade[] => named(normalize(text), TRADES).slice(0, MAX_TRADES);

/** The languages named in an answer, as said. */
export const languagesIn = (text: string): Lang[] => named(normalize(text), LANGS);

/** Yes, no, or undefined when the answer is neither. */
export function yesNo(text: string): boolean | undefined {
  const said = normalize(text);
  if (said.split(SPACE)[0] === NA || firstIn(said, NO_FINDERS) >= 0) return false;
  return firstIn(said, YES_FINDERS) >= 0 ? true : undefined;
}

/** "Skip", "छोड़ो", "ಬಿಡಿ" or a short no: leave the line about their work out. */
export function isSkip(text: string): boolean {
  const said = normalize(text);
  if (said.split(SPACE).length > SKIP_MAX_WORDS) return false;
  return firstIn(said, SKIP_FINDERS) >= 0 || yesNo(text) === false;
}

/** "None", "कोई नहीं": no language besides their own. */
export const isNone = (text: string): boolean => firstIn(normalize(text), NONE_FINDERS) >= 0;

/** The card field an answer names ("दाम" is the rate), without needing a change word. */
export function fieldIn(text: string): Field | undefined {
  const said = normalize(text);
  return FIELDS.find(([, list]) => firstIn(said, list) >= 0)?.[0];
}

/** The field a sentence asks to change ("मेरा रेट बदलो" → rate). Needs a change word and a field word together. */
export function editIntent(text: string): Field | undefined {
  return firstIn(normalize(text), CHANGE_FINDERS) >= 0 ? fieldIn(text) : undefined;
}

/** Names this short are matched exactly: one changed letter in "HSR" is another word. */
const FUZZY_MIN = 4;
/** Names up to this long allow one changed letter; longer ones two. */
const SHORT_NAME = 5;
const SHORT_SLIP = 1;
const LONG_SLIP = 2;

interface Named {
  key: string;
  name: string;
}

/** Whether a name is close enough to some run of as many words in the answer, and how close. */
function closest(words: readonly string[], { name }: Named): number | undefined {
  const size = name.split(SPACE).length;
  const letters = [...name].length;
  if (letters < FUZZY_MIN) return undefined;
  const allowed = letters <= SHORT_NAME ? SHORT_SLIP : LONG_SLIP;
  let best: number | undefined;
  for (let i = 0; i + size <= words.length; i++) {
    const d = distance(words.slice(i, i + size).join(SPACE), name);
    if (d <= allowed && (best === undefined || d < best)) best = d;
  }
  return best;
}

const namesOf = (areas: readonly AreaChoice[]): Named[] =>
  areas.flatMap((a) => a.names.map((n) => ({ key: a.key, name: normalize(n) })));

/**
 * The area a longer sentence names exactly ("electrician in HSR tomorrow"), the longest name winning. No near
 * misses: in a whole sentence, a word a letter away from an area's name is usually another word.
 */
export function areaNamedIn(text: string, areas: readonly AreaChoice[]): string | undefined {
  const said = normalize(text);
  return namesOf(areas)
    .filter((n) => n.name && finder(n.name)(said) >= 0)
    .sort((a, b) => b.name.length - a.name.length)[0]?.key;
}

/**
 * The area an answer names: any of its names inside the answer ("मैं कोरमंगला में काम करती हूँ"), the longest such
 * name winning; otherwise the name closest to a run of the answer's words, within a letter or two ("कोरमंगल").
 */
export function areaIn(text: string, areas: readonly AreaChoice[]): string | undefined {
  const inside = areaNamedIn(text, areas);
  if (inside) return inside;
  const said = normalize(text);
  const names = namesOf(areas);
  const words = said.split(SPACE);
  let best: { key: string; d: number } | undefined;
  for (const n of names) {
    const d = closest(words, n);
    if (d !== undefined && (!best || d < best.d)) best = { key: n.key, d };
  }
  return best?.key;
}
