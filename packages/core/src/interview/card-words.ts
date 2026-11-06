import { DAY_HOURS, ISO_WEEKDAYS, type IsoWeekday, MaterialsBy, TimeWindow } from "@gigsync/protocol";
import { clockText, timeIn } from "../schedule/clock.js";
import { MINUTES_PER_HOUR } from "../schedule/windows.js";
import { RANGE_JOINS, WEEKDAYS } from "../schedule/words.js";
import { numberWordValue, statedNumbers } from "./amount.js";
import { DAILY_WORDS } from "./need-words.js";
import { finder, firstIn, normalize } from "./normalize.js";
import { FLEXIBLE_WORDS, WINDOW_WORDS } from "./scope-words.js";

/**
 * A worker's hours, days and materials as said, in the three scripts plus Hinglish (ADR 0053 §7). The hours are read
 * by the schedule's clock reader, which already knows "9 to 6", "सुबह 9 से शाम 6" and "ಬೆಳಿಗ್ಗೆ 9 ರಿಂದ 6"; every answer is
 * read back, so a wrong guess shows at once.
 */

const WORD = /[\p{L}\p{M}]+/gu;
const DAY_RANGE_DASH = /[-–—]/;
const SUNDAY_INDEX = 0;
const DAYS_PER_WEEK = 7;

const FLEXIBLE = FLEXIBLE_WORDS.map(finder);
const ANY_HOURS = [...FLEXIBLE, ...["any hours", "koi bhi", "कोई भी"].map(finder)];
const EVERY_DAY_WORDS = [...DAILY_WORDS, "every day", "everyday", "all days", "all week", "हर दिन", "सातों दिन"]
  .concat(["ಪ್ರತಿದಿನ", "ದಿನಾಲೂ", "ಎಲ್ಲ ದಿನ", "ಎಲ್ಲಾ ದಿನ"])
  .map(finder);
const WEEKDAY_FINDERS = WEEKDAYS.map((names) => names.map(finder));
/** The day named is the one they do not work: "except Sunday", "रविवार छुट्टी", "ಭಾನುವಾರ ರಜೆ". */
const DAY_OFF = ["except", "not", "off", "holiday", "leave", "chhutti", "chutti", "chhodkar", "छोड़कर", "छोड़ के"]
  .concat(["छुट्टी", "नहीं", "ಬಿಟ್ಟು", "ರಜೆ", "ಇಲ್ಲ"])
  .map(finder);
/** Between two days, these make a run of days. Dashes go with `normalize`, so they are looked for in the words as said. */
const DAY_JOINS = [...RANGE_JOINS.map(normalize).filter(Boolean), "ದಿಂದ"].map(finder);
const MATERIALS_BY: Readonly<Record<MaterialsBy, readonly ReturnType<typeof finder>[]>> = {
  [MaterialsBy.enum.worker]: ["i bring", "i buy", "myself", "मैं", "main", "ನಾನೇ", "ನಾನು"].map(finder),
  [MaterialsBy.enum.household]: [
    "household",
    "customer",
    "they buy",
    "ग्राहक",
    "घरवाले",
    "घर वाले",
    "ಮನೆಯವರು",
    "ಗ್ರಾಹಕ",
  ].map(finder),
};
const EITHER = ["either", "anyone", "any", "कोई भी", "ಯಾರಾದರೂ", "ಯಾರೂ"].map(finder);

/** Number words as digits, so "nine to six" reads as "9 to 6"; only the ones a clock has. */
const clockDigits = (text: string): string =>
  text.replace(WORD, (word) => {
    const n = numberWordValue(word);
    return n !== undefined && n <= DAY_HOURS ? String(n) : word;
  });

const Meridiem = { am: "am", pm: "pm" } as const;
/** A part of the day just before an hour, each end its own: "सुबह 9 से शाम 6" is 9 am to 6 pm. */
const PART_THEN_HOUR = TimeWindow.options.map((w) => ({
  before: new RegExp(`(?:${WINDOW_WORDS[w].join("|")})\\s+(\\d{1,2}(?:[:.]\\d{2})?)`, "gu"),
  meridiem: w === TimeWindow.enum.morning ? Meridiem.am : Meridiem.pm,
}));

/** The words as the clock reader takes them: digits for number words, am or pm for a part of the day before an hour. */
const clockWords = (text: string): string =>
  PART_THEN_HOUR.reduce(
    (said, { before, meridiem }) => said.replace(before, `$1 ${meridiem}`),
    clockText(clockDigits(text)),
  );

export interface HoursSaid {
  from: number;
  /** Left out when only a start was said. */
  to?: number;
}

/** "Any time", "कभी भी": no hours of their own. */
export const anyHoursSaid = (text: string): boolean => firstIn(normalize(text), ANY_HOURS) >= 0;

/** The hours an answer names, on the clock: both ends, or a start alone ("9 am", or just "9"). */
export function hoursSaid(text: string): HoursSaid | undefined {
  const digits = clockWords(text);
  const [bare] = statedNumbers(digits);
  const read = timeIn(digits) ?? (bare === undefined ? undefined : timeIn(`${bare}:00`));
  if (!read) return undefined;
  const from = Math.floor(read.start_min / MINUTES_PER_HOUR);
  if (!read.ranged) return { from };
  return { from, to: Math.ceil(read.end_min / MINUTES_PER_HOUR) };
}

const isoOf = (index: number): IsoWeekday => (index === SUNDAY_INDEX ? DAYS_PER_WEEK : index) as IsoWeekday;

/** Every day from one to another, past Sunday if need be ("Friday to Monday"). */
function daysFrom(first: IsoWeekday, last: IsoWeekday): IsoWeekday[] {
  const count = ((last - first + DAYS_PER_WEEK) % DAYS_PER_WEEK) + 1;
  return Array.from({ length: count }, (_, i) => isoOf((first + i) % DAYS_PER_WEEK));
}

const inOrder = (days: readonly IsoWeekday[]): IsoWeekday[] => ISO_WEEKDAYS.filter((d) => days.includes(d));

/**
 * The days an answer names: an empty list for every day, undefined when it names none. "Monday to Saturday" is a run,
 * "except Sunday" the rest of the week, and anything else the days named.
 */
export function daysSaid(text: string): IsoWeekday[] | undefined {
  const said = normalize(text);
  const named = WEEKDAY_FINDERS.map((list, i) => ({ day: isoOf(i), at: firstIn(said, list) }))
    .filter((d) => d.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (named.length === 0) return firstIn(said, EVERY_DAY_WORDS) >= 0 ? [] : undefined;
  const days = named.map((d) => d.day);
  if (firstIn(said, DAY_OFF) >= 0) return ISO_WEEKDAYS.filter((d) => !days.includes(d));
  const [first, last] = named;
  if (named.length === 2 && first && last) {
    const between = said.slice(first.at, last.at);
    if (firstIn(between, DAY_JOINS) >= 0 || DAY_RANGE_DASH.test(text)) return inOrder(daysFrom(first.day, last.day));
  }
  return inOrder(days);
}

/** Who buys the materials as said: "either" is null; undefined when the answer is none of these. */
export function materialsSaid(text: string): MaterialsBy | null | undefined {
  const said = normalize(text);
  const by = MaterialsBy.options.find((m) => firstIn(said, MATERIALS_BY[m]) >= 0);
  if (by) return by;
  return firstIn(said, EITHER) >= 0 ? null : undefined;
}
