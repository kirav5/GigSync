import { QuestionKey, Trade } from "@gigsync/protocol";
import type { NeedField } from "./need.js";

/**
 * Word lists for the need interview, in the three scripts plus Hinglish: what people say when they ask for help, not
 * what the app shows. Like `lexicon.ts`, each entry is normalized when it loads; entries of four letters or more match
 * inside longer words, shorter ones only as whole words.
 */

const Q = QuestionKey.enum;
const T = Trade.enum;

/** "कल" is both yesterday and tomorrow; in a request for work it can only mean tomorrow. */
export const TOMORROW_WORDS = ["tomorrow", "tomorow", "tmrw", "kal", "कल", "ನಾಳೆ"];
/** Today, and the words for "as soon as you can", which can only mean today. */
export const TODAY_WORDS = ["today", "tonight", "this morning", "this afternoon", "this evening", "asap", "urgent"]
  .concat(["right away", "immediately", "aaj", "abhi", "turant", "आज", "अभी", "तुरंत", "फौरन"])
  .concat(["ಇಂದು", "ಇವತ್ತು", "ಇವೊತ್ತು", "ಈವತ್ತು", "ಈಗಲೇ", "ತಕ್ಷಣ"]);
/** Checked before tomorrow: "day after tomorrow" names tomorrow too. */
export const DAY_AFTER_WORDS = ["day after tomorrow", "parso", "parson", "परसों", "ನಾಡಿದ್ದು"];
export const DAILY_WORDS = ["every day", "every morning", "every evening", "each day", "daily", "everyday", "roz"]
  .concat(["rozana", "har din", "रोज", "रोजाना", "हर दिन", "प्रतिदिन"])
  .concat(["ಪ್ರತಿದಿನ", "ಪ್ರತಿ ದಿನ", "ದಿನಾಲೂ", "ದಿನಾಲು", "ದಿನನಿತ್ಯ"]);

/** Parts of the day, kept as the owner said them for the time. */
export const PART_OF_DAY = ["morning", "afternoon", "evening", "night", "subah", "dopahar", "shaam", "raat"].concat([
  "सुबह",
  "दोपहर",
  "शाम",
  "रात",
  "ಬೆಳಿಗ್ಗೆ",
  "ಬೆಳಗ್ಗೆ",
  "ಮಧ್ಯಾಹ್ನ",
  "ಸಂಜೆ",
  "ರಾತ್ರಿ",
]);
/** Words after an hour that make it a clock time ("10 am", "10 बजे", "10 ಗಂಟೆಗೆ"). */
export const CLOCK_WORDS = ["am", "pm", "a m", "p m", "baje", "बजे", "ಗಂಟೆಗೆ", "ಗಂಟೆ"];

/** Month names by number, in each script, for dates said as "5 November" or "5 नवंबर". */
export const MONTHS: readonly (readonly string[])[] = [
  ["january", "jan", "जनवरी", "ಜನವರಿ"],
  ["february", "feb", "फरवरी", "ಫೆಬ್ರವರಿ"],
  ["march", "mar", "मार्च", "ಮಾರ್ಚ್"],
  ["april", "apr", "अप्रैल", "ಏಪ್ರಿಲ್"],
  ["may", "मई", "ಮೇ"],
  ["june", "jun", "जून", "ಜೂನ್"],
  ["july", "jul", "जुलाई", "ಜುಲೈ"],
  ["august", "aug", "अगस्त", "ಆಗಸ್ಟ್"],
  ["september", "sep", "sept", "सितंबर", "ಸೆಪ್ಟೆಂಬರ್"],
  ["october", "oct", "अक्टूबर", "ಅಕ್ಟೋಬರ್"],
  ["november", "nov", "नवंबर", "ನವೆಂಬರ್"],
  ["december", "dec", "दिसंबर", "ಡಿಸೆಂಬರ್"],
];

/**
 * Words that make a number in a sentence money: a currency, a budget, or "up to". Without one, "3 people" or "2 rooms"
 * is never read as rupees.
 */
export const MONEY_CUES = ["₹", "rs", "inr", "rupees", "rupee", "rupaye", "budget", "up to", "upto", "max", "maximum"]
  .concat(["within", "रुपये", "रुपए", "रुपया", "रु", "बजट", "तक", "ज्यादा से ज्यादा"])
  .concat(["ರೂಪಾಯಿ", "ರೂ", "ಬಜೆಟ್", "ವರೆಗೆ", "ಒಳಗೆ"]);

/**
 * Words that say what is wrong or wanted, so the sentence itself answers "What exactly isn't working?". Trade words
 * (pipe, wiring, नल) are left out: "need a plumber" names the trade, not the problem.
 */
export const PROBLEM_WORDS = ["not working", "broken", "leak", "stopped", "repair", "fix", "install", "damaged"]
  .concat(["short circuit", "spark", "fuse", "blocked", "clogged", "noise", "cooling", "fan", "light", "switch"])
  .concat(["socket", "geyser", "tap", "door", "window", "cupboard", "flush", "drain", "kharab", "toot", "band ho"])
  .concat(["खराब", "काम नहीं", "नहीं चल", "बंद हो", "टूट", "लीक", "टपक", "ठीक कर", "मरम्मत", "लगाना", "लगवाना"])
  .concat(["पंखा", "बत्ती", "लाइट", "स्विच", "गीजर", "दरवाजा", "खिड़की", "अलमारी", "ठंडा नहीं"])
  .concat(["ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ", "ಹಾಳಾ", "ಕೆಟ್ಟು", "ಸೋರು", "ರಿಪೇರಿ", "ಸರಿ ಮಾಡ", "ಫ್ಯಾನ್", "ಲೈಟ್", "ಸ್ವಿಚ್"])
  .concat(["ಗೀಸರ್", "ಬಾಗಿಲು", "ಕಿಟಕಿ", "ತಣ್ಣಗಾಗ"]);

/**
 * Things that are broken, naming the trade that fixes them, for a sentence that names no trade ("the sink is blocked").
 * Only the need interview reads these; a worker naming their own trade uses `lexicon.ts`.
 */
export const OBJECT_TRADES: Readonly<Partial<Record<Trade, readonly string[]>>> = {
  [T.plumber]: ["tap", "sink", "toilet", "flush", "drain", "basin", "सिंक", "टॉयलेट", "फ्लश", "नाली", "ಸಿಂಕ್", "ಟಾಯ್ಲೆಟ್"],
  [T.electrician]: ["fan", "switch", "socket", "fuse", "mcb", "short circuit", "पंखा", "स्विच", "बत्ती", "फ्यूज"].concat([
    "ಫ್ಯಾನ್",
    "ಸ್ವಿಚ್",
    "ಫ್ಯೂಸ್",
  ]),
  [T.carpenter]: ["cupboard", "wardrobe", "hinge", "drawer", "अलमारी", "दराज", "ಅಲ್ಮೇರಾ", "ಕಪಾಟು"],
  [T.painter]: ["paint", "पेंट", "ಪೇಂಟ್"],
  [T.cook]: ["lunch", "dinner", "breakfast", "meals", "tiffin", "नाश्ता", "ಊಟ", "ತಿಂಡಿ"],
  [T.maid]: ["sweep", "mopping", "dishes", "utensils", "laundry"],
};

/** Count questions a number in the sentence can answer, by the word after it ("3 people", "2 कमरे", "500 sq ft"). */
export const COUNT_WORDS: Readonly<Partial<Record<QuestionKey, readonly string[]>>> = {
  [Q.people]: ["people", "persons", "members", "log", "लोग", "सदस्य", "ಜನ", "ಮಂದಿ"],
  [Q.rooms]: ["rooms", "room", "bhk", "kamre", "कमरे", "कमरा", "ಕೋಣೆ", "ರೂಮ್", "ರೂಂ"],
  [Q.area_sqft]: ["sq ft", "sqft", "square feet", "square foot", "वर्ग फुट", "स्क्वायर फीट", "ಚದರ ಅಡಿ"],
};

/** Words naming each field to change from the readback, most specific first ("budget" before "work"). */
export const NEED_FIELD_WORDS: Readonly<Record<NeedField, readonly string[]>> = {
  budget: ["budget", "price", "pay", "money", "amount", "बजट", "दाम", "पैसे", "ಬಜೆಟ್", "ಹಣ", "ದುಡ್ಡು", "ಬೆಲೆ"],
  arrangement: ["how long", "hours", "monthly", "कितने समय", "घंटे", "महीने", "ಎಷ್ಟು ಸಮಯ", "ಗಂಟೆ", "ತಿಂಗಳ"],
  when: ["when", "day", "date", "time", "कब", "दिन", "तारीख", "समय", "ಯಾವಾಗ", "ದಿನ", "ದಿನಾಂಕ", "ಸಮಯ"],
  area: ["area", "place", "इलाका", "जगह", "एरिया", "ಏರಿಯಾ", "ಜಾಗ"],
  detail: ["detail", "problem", "समस्या", "दिक्कत", "ವಿವರ", "ಸಮಸ್ಯೆ"],
  trade: ["work", "worker", "trade", "काम", "ಕೆಲಸ"],
};
