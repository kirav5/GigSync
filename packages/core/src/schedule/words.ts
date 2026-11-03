import { MONTHS, PART_OF_DAY, TODAY_WORDS, TOMORROW_WORDS } from "../interview/need-words.js";

/**
 * Word lists for a worker's schedule (ADR 0048), in English, Hindi, Kannada, Hinglish and Kanglish: what a worker says
 * to keep, ask about or cancel a booking. Like the need interview's lists, entries are normalized when they load;
 * entries of four letters or more match inside longer words, shorter ones only as whole words.
 */

/**
 * Words for a booking or the schedule itself. Not "appointment" or "calendar": a doctor's appointment is a note, and
 * "let Ravi see my calendar" a rule.
 */
export const BOOKING_WORDS = ["booking", "bookings", "schedule"]
  .concat(["बुकिंग", "शेड्यूल"])
  .concat(["ಬುಕಿಂಗ್", "ಬುಕ್ಕಿಂಗ್", "ಶೆಡ್ಯೂಲ್", "ವೇಳಾಪಟ್ಟಿ"]);

/** The owner's own: "my bookings", not a gas booking they once noted. */
export const MINE_WORDS = ["my", "mine", "i", "mera", "meri", "mere", "मेरा", "मेरी", "मेरे", "ನನ್ನ", "nanna", "nan"];

/** The days of the week, Sunday first (as `Date.getUTCDay` counts), in each script and as typed in Latin letters. */
export const WEEKDAYS: readonly (readonly string[])[] = [
  ["sunday", "ravivar", "raviwar", "itvar", "इतवार", "रविवार", "ಭಾನುವಾರ", "ರವಿವಾರ", "bhanuvara", "bhanuvaara"],
  ["monday", "somvar", "somwar", "सोमवार", "ಸೋಮವಾರ", "somavara", "somvaara", "somavaara"],
  ["tuesday", "mangalvar", "mangalwar", "मंगलवार", "ಮಂಗಳವಾರ", "mangalavara", "mangalavaara"],
  ["wednesday", "budhvar", "budhwar", "बुधवार", "ಬುಧವಾರ", "budhavara", "budhavaara"],
  ["thursday", "guruvar", "guruwar", "veervar", "गुरुवार", "बृहस्पतिवार", "ಗುರುವಾರ", "guruvara", "guruvaara"],
  ["friday", "shukravar", "shukrawar", "शुक्रवार", "ಶುಕ್ರವಾರ", "shukravara", "shukravaara"],
  ["saturday", "shanivar", "shaniwar", "शनिवार", "ಶನಿವಾರ", "shanivara", "shanivaara"],
];

/** Work words that, beside a time, make a sentence a booking ("kal 2 se 3 kaam hai"). */
export const WORK_WORDS = ["job", "work", "kaam", "काम", "ಕೆಲಸ", "kelsa", "kelasa"];

/** Words that ask to take a booking off. Checked first: "cancel my booking tomorrow 2pm" is never saved. */
export const CANCEL_WORDS = ["cancel", "delete", "remove", "called off", "not happening", "drop it"]
  .concat(["hatao", "hata do", "hatado", "hata dena", "radd", "mita do"])
  .concat(["रद्द", "हटाओ", "हटा दो", "हटा दें", "कैंसल", "मिटा दो"])
  .concat(["ರದ್ದು", "ಕ್ಯಾನ್ಸಲ್", "ತೆಗೆದುಹಾಕಿ", "ತೆಗೆದು ಹಾಕಿ", "ತೆಗೆಯಿರಿ", "ಅಳಿಸಿ", "tegedu", "tegdu", "tegi"]);

/** Words that ask what is on the schedule rather than add to it. */
export const ASK_WORDS = ["what", "whats", "show", "list", "which", "do i have", "am i free", "any booking"]
  .concat(["kya", "kaun", "kaunsi", "dikhao", "batao", "kitni", "kitne"])
  .concat(["क्या", "कौन", "कौनसी", "दिखाओ", "बताओ", "कितनी", "कितने"])
  .concat(["ಏನು", "ಏನಿದೆ", "ಏನೇನು", "ಏನೇನಿದೆ", "ಯಾವ", "ಯಾವುದು", "ತೋರಿಸಿ", "ತೋರಿಸು", "ಹೇಳಿ"])
  .concat(["enu", "enide", "enenu", "enenide", "yaava", "torisi"]);

/** A question mark (in any script's text) makes a message a question too. */
export const QUESTION_MARK = "?";

/** Joins the two ends of a time range: "2-3", "2 to 3", "2 से 3", "2 ರಿಂದ 3". */
export const RANGE_JOINS = ["-", "–", "—", "to", "till", "until", "se", "से", "ರಿಂದ", "ಇಂದ", "inda", "rinda"];
/** Closes a range ("2 se 3 tak", "2 ರಿಂದ 3 ವರೆಗೆ"). */
export const RANGE_ENDS = ["tak", "तक", "ವರೆಗೆ", "ರವರೆಗೆ", "ವರೆಗು", "varege", "tanaka"];

/** Words after an hour that make it a clock time; "o'clock" is written with and without its apostrophe. */
export const CLOCK_MARKS = ["baje", "बजे", "ಗಂಟೆಗೆ", "ಗಂಟೆಯ", "ಗಂಟೆ", "gante", "gantege", "oclock", "o'clock"];

/**
 * Words that say how to keep a booking or what it is, never where or for whom: what is left once these, the day and
 * the time are taken out is the booking's note ("at Sharma ji's house").
 */
const COMMAND_WORDS = ["save", "saved", "add", "put", "keep", "note", "remember", "please", "new", "set", "block"]
  .concat(["write", "down", "that", "i'm", "im", "got", "will", "be", "am"])
  .concat(["my", "a", "an", "the", "i", "i've", "ive", "have", "has", "got", "there", "is", "its", "it's", "it"])
  .concat(["for", "on", "at", "from", "in", "of", "with", "and", "slot", "gig", "me", "this", "next"])
  .concat(["mera", "meri", "mere", "mujhe", "hai", "h", "karo", "kar", "do", "lo", "le", "dena", "rakh", "rakho"])
  .concat(["rakhna", "yaad", "ki", "ka", "wali", "wala", "pe", "par", "liye", "ek", "likh", "daalo", "dalo", "jodo"])
  .concat(["mein", "ye", "yeh", "lo", "lena"])
  .concat(["मेरा", "मेरी", "मेरे", "मुझे", "है", "हैं", "करो", "कर", "दो", "लो", "सेव", "की", "का", "याद", "रखो"])
  .concat(["रखना", "नोट", "वाली", "वाला", "पर", "लिए", "एक", "और", "लिख", "डालो", "डाल", "जोड़", "जोड़ो", "में", "ये"])
  .concat(["ನನ್ನ", "ನನಗೆ", "ಉಳಿಸಿ", "ಉಳಿಸು", "ಸೇವ್", "ಮಾಡಿ", "ಮಾಡು", "ಇದೆ", "ಬರೆದಿಡು", "ನೆನಪಿಡು", "ಒಂದು"])
  .concat(["ಬರೆದುಕೊಳ್ಳಿ", "ಹಾಕಿ", "ಸೇರಿಸಿ", "ಇಡಿ"])
  .concat(["nanna", "nange", "maadi", "maadu", "ide", "ulisi", "ondu", "bardko", "haaki", "serisi", "ge"])
  .concat(["beligge", "madhyahna", "sanje", "raatri"]);

/** Every whole word that is never part of a note: commands, schedule and work words, days, months, parts of day. */
export const NOT_NOTE_WORDS: readonly string[] = [
  ...COMMAND_WORDS,
  ...BOOKING_WORDS,
  ...WORK_WORDS,
  ...RANGE_JOINS,
  ...RANGE_ENDS,
  ...CLOCK_MARKS,
  ...TOMORROW_WORDS,
  ...TODAY_WORDS,
  ...PART_OF_DAY,
  ...MONTHS.flat(),
  ...WEEKDAYS.flat(),
  ...["day", "after", "every", "daily", "roz", "rozana", "har", "din", "parso", "परसों", "रोज", "हर", "दिन"],
  ...["ನಾಡಿದ್ದು", "ಪ್ರತಿದಿನ", "ದಿನಾಲೂ", "dina", "pratidina"],
];
