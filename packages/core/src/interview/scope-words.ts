import { MaidFrequency, QuestionKey, TimeWindow } from "@gigsync/protocol";
import { COUNT_WORDS, DAILY_WORDS } from "./need-words.js";

/**
 * Word lists for reading a job's scope from a household's own description (ADR 0033 §5), in the three scripts plus
 * Hinglish: counts said with what they count, who buys the paint, how often, and words that say the day's time does
 * not matter. Like `need-words.ts`, entries are normalized on load; four letters or more match inside longer words.
 */

const Q = QuestionKey.enum;

/** Count details a description can give, by the word after the number ("3 rooms", "2 coats", "8 घंटे"). */
export const SCOPE_COUNT_WORDS: Readonly<Partial<Record<QuestionKey, readonly string[]>>> = {
  ...COUNT_WORDS,
  [Q.coats]: ["coats", "coat", "कोट", "ಕೋಟ್"],
  [Q.meals]: ["meals", "meal", "times a day", "वक्त", "टाइम खाना", "बार खाना", "ಹೊತ್ತು", "ಊಟ"],
  // "ಗಂಟೆ" alone is a clock time ("8 ಗಂಟೆಗೆ"); only the plural and "ತಾಸು" are hours of work.
  [Q.hours]: ["hours", "hour", "hrs", "घंटे", "घंटा", "ಗಂಟೆಗಳು", "ತಾಸು"],
};

/** The household buys the paint: the painter's work is labour only. */
export const LABOUR_ONLY_WORDS = ["buy the paint", "buy paint", "paint provided", "have the paint", "labour only"]
  .concat(["labor only", "only labour", "only labor", "own paint", "पेंट मैं", "पेंट हम", "पेंट हमारा", "सिर्फ मजदूरी"])
  .concat(["ಪೇಂಟ್ ನಾನೇ", "ಪೇಂಟ್ ನಾವೇ", "ಕೂಲಿ ಮಾತ್ರ"]);

/** The painter brings the paint. */
export const WITH_PAINT_WORDS = [
  "with paint",
  "including paint",
  "bring the paint",
  "bring paint",
  "paint included",
].concat(["पेंट के साथ", "पेंट लेकर", "पेंट भी लाना", "ಪೇಂಟ್ ಸಮೇತ", "ಪೇಂಟ್ ತನ್ನಿ", "ಪೇಂಟ್ ಸಹಿತ"]);

/** How often a maid comes, by `MaidFrequency`; every day is the need interview's own list. */
export const FREQUENCY_WORDS: Readonly<Record<MaidFrequency, readonly string[]>> = {
  [MaidFrequency.enum.alternate_days]: ["alternate days", "every other day", "एक दिन छोड़कर", "ದಿನ ಬಿಟ್ಟು ದಿನ"],
  [MaidFrequency.enum.weekly]: ["once a week", "weekly", "हफ्ते में एक", "हफ़्ते में एक", "ವಾರಕ್ಕೊಮ್ಮೆ"],
  [MaidFrequency.enum.daily]: DAILY_WORDS,
};

/** Any time that day will do: the household is flexible about the window. */
export const FLEXIBLE_WORDS = [
  "any time",
  "anytime",
  "flexible",
  "whenever",
  "no hurry",
  "कभी भी",
  "किसी भी समय",
].concat(["ಯಾವಾಗ ಬೇಕಾದರೂ", "ಯಾವಾಗಲಾದರೂ"]);

/** Parts of the day as people say them, by the window they fall in. */
export const WINDOW_WORDS: Readonly<Record<TimeWindow, readonly string[]>> = {
  [TimeWindow.enum.morning]: ["morning", "subah", "सुबह", "ಬೆಳಿಗ್ಗೆ", "ಬೆಳಗ್ಗೆ"],
  [TimeWindow.enum.afternoon]: ["afternoon", "dopahar", "दोपहर", "ಮಧ್ಯಾಹ್ನ"],
  [TimeWindow.enum.evening]: ["evening", "night", "shaam", "raat", "शाम", "रात", "ಸಂಜೆ", "ರಾತ್ರಿ"],
};

/** Words after an hour that make it afternoon or later ("3 pm"), and those that keep it before noon. */
export const PM_WORDS = ["pm", "p m"];
export const AM_WORDS = ["am", "a m"];
