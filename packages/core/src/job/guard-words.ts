import { QuestionKey } from "@gigsync/protocol";

/**
 * The word lists behind the question guards (`guard.ts`): what a model-written question may never be about, in every
 * language the app speaks, and which standard detail each question is about. Deliberately broad: dropping a fair
 * question costs a standard key instead; letting a bad one through costs the household's trust.
 */

/** Latin words as whole words, any case, with a plural `s` where it makes sense. */
const latin = (words: readonly string[]) => new RegExp(`\\b(?:${words.join("|")})\\b`, "i");
/** Devanagari and Kannada have no word boundaries in JavaScript patterns: their words match anywhere. */
const indic = (words: readonly string[]) => new RegExp(words.join("|"), "u");

/** Why a guard dropped a question; kept for the logs and the tests. */
export const DropReason = {
  shape: "shape",
  length: "length",
  mark: "mark",
  /** Two sentences, or a statement with a question tacked on. */
  compound: "compound",
  duplicate: "duplicate",
  /** Only the household's own words again. */
  echo: "echo",
  known: "known",
  money: "money",
  contact: "contact",
  place: "place",
  identity: "identity",
  outside: "outside",
  link: "link",
  digits: "digits",
  over: "over",
} as const;
export type DropReason = (typeof DropReason)[keyof typeof DropReason];

const D = DropReason;

/** Each topic a question may never touch, with its words in English, Hindi and Kannada. */
export const DENY: ReadonlyArray<readonly [DropReason, readonly RegExp[]]> = [
  [
    D.money,
    [
      latin([
        "prices?",
        "pricing",
        "costs?",
        "budgets?",
        "rates?",
        "pay",
        "paid",
        "paying",
        "payments?",
        "charges?",
        "fees?",
        "money",
        "cash",
        "rupees?",
        "rs",
        "inr",
        "salary",
        "wages?",
        "afford",
        "expensive",
        "cheap",
        "discount",
        "advance",
        "deposit",
        "tips?",
        "quotes?",
        "estimates?",
      ]),
      indic(["₹", "पैस", "रुपय", "रुपए", "रुपये", "कीमत", "दाम", "बजट", "भुगतान", "शुल्क", "फीस", "वेतन", "तनख्वाह", "नकद"]),
      indic(["ಹಣ", "ದುಡ್ಡು", "ರೂಪಾಯಿ", "ಬೆಲೆ", "ದರ", "ಬಜೆಟ್", "ಪಾವತಿ", "ಶುಲ್ಕ", "ಸಂಬಳ", "ನಗದು", "ಖರ್ಚು"]),
    ],
  ],
  [
    D.contact,
    [
      latin([
        "phones?",
        "mobile",
        "numbers?",
        "call",
        "calling",
        "whatsapp",
        "e-?mail",
        "contacts?",
        "sms",
        "telegram",
      ]),
      indic(["@", "फोन", "फ़ोन", "मोबाइल", "नंबर", "कॉल", "व्हाट्सएप", "व्हाट्सऐप", "ईमेल", "संपर्क"]),
      indic(["ಫೋನ್", "ಮೊಬೈಲ್", "ನಂಬರ್", "ಕರೆ ಮಾಡ", "ವಾಟ್ಸಾಪ್", "ಇಮೇಲ್", "ಸಂಪರ್ಕ"]),
    ],
  ],
  [
    D.place,
    [
      latin(["address", "location", "street", "landmark", "pin ?code", "gps", "house number", "flat number", "door"]),
      indic(["पता", "पते", "लोकेशन", "गली", "पिन कोड", "मकान नंबर"]),
      indic(["ವಿಳಾಸ", "ಸ್ಥಳ", "ಬೀದಿ", "ಪಿನ್ ಕೋಡ್", "ಮನೆ ನಂಬರ್"]),
    ],
  ],
  [
    D.identity,
    [
      latin([
        "names?",
        "caste",
        "religion",
        "religious",
        "aadhaa?r",
        "pan card",
        "otp",
        "banks?",
        "account",
        "upi",
        "ifsc",
        "age",
        "how old are you",
        "married",
        "marital",
        "husband",
        "wife",
      ]),
      indic(["नाम", "जाति", "धर्म", "आधार", "ओटीपी", "बैंक", "खाता", "यूपीआई", "उम्र", "शादी", "विवाह"]),
      indic(["ಹೆಸರು", "ಜಾತಿ", "ಧರ್ಮ", "ಆಧಾರ್", "ಒಟಿಪಿ", "ಬ್ಯಾಂಕ್", "ಖಾತೆ", "ಯುಪಿಐ", "ವಯಸ್ಸು", "ಮದುವೆ"]),
    ],
  ],
  [
    D.outside,
    [
      latin([
        "meet",
        "meeting",
        "outside",
        "offline",
        "sign (?:the|a|this|here|it)",
        "signature",
        "contract",
        "in person",
        "app",
      ]),
      indic(["मिलें", "मिलना", "मिलो", "बाहर", "हस्ताक्षर", "ऐप"]),
      indic(["ಭೇಟಿ", "ಹೊರಗೆ", "ಸಹಿ", "ಆ್ಯಪ್"]),
    ],
  ],
  [D.link, [/https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|in|org|net|io|me|ly|co)\b/i]],
];

/** What each standard detail is called, so a written question about a detail already known is caught. */
export const TOPIC: Readonly<Record<QuestionKey, readonly RegExp[]>> = {
  problem: [latin(["problem", "issue", "what is wrong", "what's wrong"]), indic(["समस्या", "ದೋಷ", "ಸಮಸ್ಯೆ"])],
  rooms: [latin(["rooms?", "bhk", "bedrooms?"]), indic(["कमर", "ಕೋಣೆ", "ರೂಮ್"])],
  area_sqft: [latin(["square (?:feet|foot|metres?)", "sq\\.? ?ft", "sqft", "area"]), indic(["वर्ग फ", "ಚದರ"])],
  people: [latin(["people", "persons?", "members", "family"]), indic(["लोग", "सदस्य", "ಜನ", "ಸದಸ್ಯ"])],
  meals: [latin(["meals?", "breakfast", "lunch", "dinner", "tiffin"]), indic(["खाना", "नाश्त", "ಊಟ", "ತಿಂಡಿ"])],
  pets: [latin(["pets?", "dogs?", "cats?", "animals?"]), indic(["पालतू", "कुत्त", "ಸಾಕು", "ನಾಯಿ", "ಬೆಕ್ಕು"])],
  route: [latin(["route", "where to", "destination", "pick ?up", "drop"]), indic(["रास्त", "ಮಾರ್ಗ"])],
};

/** The standard detail a question's words are about, if any. */
export function topicOf(text: string): QuestionKey | undefined {
  return QuestionKey.options.find((key) => TOPIC[key].some((p) => p.test(text)));
}
