import { MINUTES_PER_DAY, TimeWindow } from "@gigsync/protocol";
import { finder, firstIn, normalize } from "../interview/normalize.js";
import { AM_WORDS, PM_WORDS, WINDOW_WORDS } from "../interview/scope-words.js";
import { asciiDigits } from "../job/details.js";
import { AFTERNOON_FROM, MINUTES_PER_HOUR } from "./windows.js";
import { CLOCK_MARKS, RANGE_ENDS, RANGE_JOINS } from "./words.js";

/**
 * A booking's hours as said (ADR 0048 §3): "2-3PM", "2 to 3 pm", "14:00-15:30", "दोपहर 2 से 3 बजे", "ಮಧ್ಯಾಹ್ನ 2 ರಿಂದ 3".
 * Am or pm comes from the time itself, else from a part of the day in the sentence, else from the hour (work happens
 * at 2 in the afternoon, not at night). The reply repeats what was read, so a wrong guess shows at once.
 */

/** A booking said with a start only lasts this long. */
export const DEFAULT_BOOKING_MINUTES = 60;

const HOURS_PER_HALF_DAY = 12;
/** Without am, pm or a part of the day, these hours are in the afternoon: nobody books work at 3 at night. */
const LAST_AFTERNOON_GUESS = 6;
const HALF_DAY = HOURS_PER_HALF_DAY * MINUTES_PER_HOUR;

export interface ReadTime {
  start_min: number;
  end_min: number;
  /** Where the time was found in `said`, so the day and the note are read without it. */
  from: number;
  to: number;
  /** Both ends were said; otherwise `end_min` is the length a booking has by default. */
  ranged: boolean;
}

const Meridiem = { am: "am", pm: "pm" } as const;
type Meridiem = (typeof Meridiem)[keyof typeof Meridiem];

const SPECIAL = /[.*+?^${}()|[\]\\]/g;
const alt = (words: readonly string[]) =>
  [...words]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(SPECIAL, "\\$&"))
    .join("|");
const NO_LETTER_AFTER = "(?![\\p{L}\\p{M}])";
const NUMBER = "(?<![\\d:.])(\\d{1,2})(?:[:.](\\d{2}))?";
const MERIDIEM = `(?:\\s?(${alt([...AM_WORDS, ...PM_WORDS])})${NO_LETTER_AFTER})?`;
const MARK = `(?:\\s?(?:${alt(CLOCK_MARKS)})${NO_LETTER_AFTER})?`;
const RANGE = new RegExp(
  `${NUMBER}${MERIDIEM}${MARK}\\s*(?:${alt(RANGE_JOINS)})\\s*${NUMBER}${MERIDIEM}(${MARK})(?:\\s*(?:${alt(RANGE_ENDS)}))?`,
  "gu",
);
/** One time with am, pm or a clock word after it, or written with its minutes ("14:00"). */
const SINGLE = new RegExp(
  `${NUMBER}(?:\\s?(${alt([...AM_WORDS, ...PM_WORDS])})|\\s?(${alt(CLOCK_MARKS)}))${NO_LETTER_AFTER}`,
  "gu",
);
const COLON = /(?<![\d:.])(\d{1,2}):(\d{2})(?!\d)/gu;
/** "a.m." and "p.m." as "am" and "pm". */
const DOTTED = /\b([ap])\.\s?m\.?/g;

const PM_SET: ReadonlySet<string> = new Set(PM_WORDS);
const meridiemOf = (word: string | undefined): Meridiem | undefined =>
  word === undefined ? undefined : PM_SET.has(word) ? Meridiem.pm : Meridiem.am;

const WINDOW_FINDERS = TimeWindow.options.map((w) => [w, WINDOW_WORDS[w].map(finder)] as const);

/** Am or pm from a part of the day said anywhere in the sentence ("दोपहर", "ಸಂಜೆ", "morning"). */
function hintIn(text: string): Meridiem | undefined {
  const said = normalize(text);
  const named = WINDOW_FINDERS.find(([, list]) => firstIn(said, list) >= 0)?.[0];
  if (!named) return undefined;
  return named === TimeWindow.enum.morning ? Meridiem.am : Meridiem.pm;
}

/** The text times are read from: lowercase, Western digits, "p.m." as "pm". Offsets refer to this string. */
export const clockText = (text: string): string =>
  asciiDigits(text.normalize("NFC").toLowerCase()).replace(DOTTED, "$1m");

/** Minutes after midnight for an hour and minute, with am or pm when said; undefined for an hour no clock has. */
function minutesOf(hour: number, minute: number, said: Meridiem | undefined, hint: Meridiem | undefined) {
  if (minute >= MINUTES_PER_HOUR || hour > 2 * HOURS_PER_HALF_DAY) return undefined;
  if (said && (hour < 1 || hour > HOURS_PER_HALF_DAY)) return undefined;
  const meridiem = said ?? (hour > HOURS_PER_HALF_DAY || hour === 0 ? undefined : hint);
  const guess = hour > 0 && hour <= LAST_AFTERNOON_GUESS ? Meridiem.pm : undefined;
  const pm = (meridiem ?? guess) === Meridiem.pm;
  const clock = hour === HOURS_PER_HALF_DAY ? (meridiem === Meridiem.am ? 0 : AFTERNOON_FROM) : hour;
  const h = pm && clock < HOURS_PER_HALF_DAY ? clock + HOURS_PER_HALF_DAY : clock;
  return h * MINUTES_PER_HOUR + minute;
}

/** Both ends of a range; an end said without am or pm takes the other end's, or the half day that keeps it in order. */
function rangeOf(m: RegExpMatchArray, hint: Meridiem | undefined): [number, number] | undefined {
  const [h1, m1, h2, m2] = [m[1], m[2], m[4], m[5]].map((v) => Number(v ?? 0)) as [number, number, number, number];
  const s = meridiemOf(m[3]);
  const e = meridiemOf(m[6]);
  const end = minutesOf(h2, m2, e ?? s, e || s ? undefined : hint);
  let start = minutesOf(h1, m1, s ?? e, s || e ? undefined : hint);
  if (start !== undefined && end !== undefined && start >= end && !s && e) start -= HALF_DAY;
  if (start === undefined || end === undefined) return undefined;
  // Midnight at the end is the end of the day: "10pm-12am" runs to 24:00, never back to the morning.
  const midnight = end === 0 && e ? MINUTES_PER_DAY : end;
  const later = midnight <= start && !e && midnight + HALF_DAY <= MINUTES_PER_DAY ? midnight + HALF_DAY : midnight;
  return start >= 0 && later > start ? [start, later] : undefined;
}

/**
 * The first time a sentence names: a range with am, pm or a clock word, else one time with one, else a range said
 * bare ("kal 2 se 3"), else a time with its minutes. A bare "5-11" is a date as often as a range, so it comes late.
 */
export function timeIn(text: string): ReadTime | undefined {
  const said = clockText(text);
  const hint = hintIn(text);
  const ranges = [...said.matchAll(RANGE)].flatMap((m) => {
    const r = rangeOf(m, hint);
    const marked = Boolean(m[3] || m[6] || m[7]);
    if (!r) return [];
    const at = m.index ?? 0;
    return [{ start_min: r[0], end_min: r[1], from: at, to: at + m[0].length, ranged: true, marked }];
  });
  const single = (m: RegExpMatchArray, said_: Meridiem | undefined): ReadTime | undefined => {
    const start = minutesOf(Number(m[1]), Number(m[2] ?? 0), said_, said_ ? undefined : hint);
    if (start === undefined) return undefined;
    const end = Math.min(start + DEFAULT_BOOKING_MINUTES, MINUTES_PER_DAY);
    return { start_min: start, end_min: end, from: m.index ?? 0, to: (m.index ?? 0) + m[0].length, ranged: false };
  };
  const singles = [...said.matchAll(SINGLE)].map((m) => single(m, meridiemOf(m[3])));
  const colons = [...said.matchAll(COLON)].map((m) => single(m, undefined));
  const picked = ranges.find((r) => r.marked) ?? singles.find(Boolean) ?? ranges[0] ?? colons.find(Boolean);
  if (!picked) return undefined;
  const { start_min, end_min, from, to, ranged } = picked;
  return { start_min, end_min, from, to, ranged };
}
