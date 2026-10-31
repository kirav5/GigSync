import { Lang } from "@gigsync/protocol";
import { normalize } from "../interview/normalize.js";

/**
 * The common needs of someone new to a city, as people say them, so "Ask the guide" finds a section when the question
 * is in Hindi or Kannada: the guide's keywords are English. Each need names the English words it looks for in the
 * guide. Words a need is heard by are stems where the language adds endings (रहने, ಉಳಿಯಬಹುದು); words that mean other
 * things in everyday talk are left out or kept only in a phrase (Hindi बस is also "enough", खाता also "eats"). Every
 * word matches at the start of a word, with any ending: "room" in "rooms", never "rent" in "current".
 */
export const GuideNeed = {
  stay: "stay",
  bank: "bank",
  sim: "sim",
  aadhaar: "aadhaar",
  bus: "bus",
  eshram: "eshram",
  police: "police",
  wages: "wages",
  help: "help",
  upi: "upi",
  union: "union",
  legal: "legal",
} as const;
export type GuideNeed = (typeof GuideNeed)[keyof typeof GuideNeed];

const N = GuideNeed;
const L = Lang.enum;

/** The English words each need looks for in a section's keywords, title and body. A need's name is an English word for it. */
export const NEED_TERMS: Readonly<Record<GuideNeed, readonly string[]>> = {
  [N.stay]: [N.stay, "hostel", "bed", "first night"],
  [N.bank]: ["bank account"],
  [N.sim]: [N.sim, "mobile"],
  [N.aadhaar]: [N.aadhaar, "address update"],
  [N.bus]: [N.bus, "bmtc"],
  [N.eshram]: ["e-shram", N.eshram],
  [N.police]: [N.police],
  [N.wages]: ["wage", "pay", "salary"],
  [N.help]: ["helpline", "emergency"],
  [N.upi]: [N.upi],
  [N.union]: [N.union],
  [N.legal]: ["lawyer", "legal aid"],
};

/** What people say for each need, by language. English counts in every language, since people mix it in. */
const HEARD: Readonly<Record<Lang, Readonly<Record<GuideNeed, readonly string[]>>>> = {
  [L.en]: {
    [N.stay]: ["room", N.stay, "sleep", "hostel", "bed", "rent", "accommodation", "lodge", "shelter", "pg"],
    [N.bank]: [N.bank, "account", "passbook"],
    [N.sim]: [N.sim, "phone number", "mobile connection"],
    [N.aadhaar]: [N.aadhaar, "aadhar", "adhar", "address proof"],
    [N.bus]: [N.bus, "commute", "travel pass"],
    [N.eshram]: [N.eshram, "e-shram", "shram", "register", "registration"],
    [N.police]: [N.police, "verification"],
    [N.wages]: ["wage", N.wages, "salary", "pay", "paid"],
    [N.help]: [N.help, "emergency", "danger", "unsafe", "trouble"],
    [N.upi]: [N.upi, "gpay", "phonepe", "paytm"],
    [N.union]: [N.union],
    [N.legal]: ["lawyer", N.legal, "court"],
  },
  [L.hi]: {
    [N.stay]: [
      "कमरा",
      "कमरे",
      "रहने",
      "रहना",
      "रहूं",
      "ठहर",
      "हॉस्टल",
      "होस्टल",
      "किराए का",
      "सोने की जगह",
      "kamra",
      "rehne",
      "rahne",
    ],
    [N.bank]: ["बैंक", "बैंक खाता", "खाता खोल", "khata"],
    [N.sim]: ["सिम", "मोबाइल नंबर", "मोबाइल कनेक्शन"],
    [N.aadhaar]: ["आधार", "पते का सबूत"],
    [N.bus]: ["बस पास", "बस से", "बस का", "बस में", "सफर"],
    [N.eshram]: ["ई-श्रम", "ईश्रम", "श्रम कार्ड", "पंजीकरण", "रजिस्ट्रेशन"],
    [N.police]: ["पुलिस", "वेरिफिकेशन", "सत्यापन"],
    [N.wages]: ["मजदूरी", "तनख्वाह", "वेतन", "पगार", "सैलरी"],
    [N.help]: ["मदद", "सहायता", "हेल्पलाइन", "खतरा", "खतरे"],
    [N.upi]: ["यूपीआई"],
    [N.union]: ["यूनियन", "संघ"],
    [N.legal]: ["वकील", "कानूनी"],
  },
  [L.kn]: {
    [N.stay]: ["ಕೋಣೆ", "ರೂಮ್", "ಉಳಿಯ", "ಉಳಿದು", "ಉಳಿಯೋ", "ವಸತಿ", "ಹಾಸ್ಟೆಲ್", "ಬಾಡಿಗೆ", "ಮಲಗಲು"],
    [N.bank]: ["ಬ್ಯಾಂಕ್", "ಖಾತೆ"],
    [N.sim]: ["ಸಿಮ್", "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ", "ಮೊಬೈಲ್ ನಂಬರ್"],
    [N.aadhaar]: ["ಆಧಾರ್"],
    [N.bus]: ["ಬಸ್", "ಪಾಸ್"],
    [N.eshram]: ["ಇ-ಶ್ರಮ್", "ಶ್ರಮ್", "ನೋಂದಣಿ"],
    [N.police]: ["ಪೊಲೀಸ್", "ಪರಿಶೀಲನೆ"],
    [N.wages]: ["ಸಂಬಳ", "ಕೂಲಿ", "ವೇತನ"],
    [N.help]: ["ಸಹಾಯ", "ನೆರವು", "ಸಹಾಯವಾಣಿ", "ತುರ್ತು"],
    [N.upi]: ["ಯುಪಿಐ"],
    [N.union]: ["ಯೂನಿಯನ್", "ಸಂಘ"],
    [N.legal]: ["ವಕೀಲ", "ಕಾನೂನು"],
  },
};

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** True when a normalized text has these words at the start of a word, with any ending ("hostel" in "hostels"). */
export type WordTest = (said: string) => boolean;
export function startsWord(words: string): WordTest {
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${normalize(words).replace(SPECIAL, "\\$&")}`, "u");
  return (said) => pattern.test(said);
}

const NEEDS = Object.values(GuideNeed);
const tests = (lang: Lang): Readonly<Record<GuideNeed, readonly WordTest[]>> =>
  Object.fromEntries(NEEDS.map((need) => [need, HEARD[lang][need].map(startsWord)])) as Record<GuideNeed, WordTest[]>;
const TESTS: Readonly<Record<Lang, Readonly<Record<GuideNeed, readonly WordTest[]>>>> = {
  [L.en]: tests(L.en),
  [L.hi]: tests(L.hi),
  [L.kn]: tests(L.kn),
};

/**
 * The needs a normalized question names, in the owner's language and in English. "Help" counts only when nothing
 * else is named: "help me find a room" asks for a room, and an emergency number is not the answer to it.
 */
export function needsIn(said: string, lang: Lang): GuideNeed[] {
  const langs = lang === L.en ? [L.en] : [L.en, lang];
  const named = NEEDS.filter((need) => langs.some((l) => TESTS[l][need].some((heard) => heard(said))));
  const specific = named.filter((need) => need !== N.help);
  return specific.length > 0 ? specific : named;
}
