import { BOOKING_NOTE_MAX } from "@gigsync/protocol";
import { DayWord } from "../interview/need.js";
import { addDays, dayIn } from "../interview/need-parse.js";
import { MONTHS, PART_OF_DAY, TODAY_WORDS, TOMORROW_WORDS } from "../interview/need-words.js";
import { type Finder, finder, firstIn, normalize, SPACE } from "../interview/normalize.js";
import { clockText, timeIn } from "./clock.js";
import type { LocalNow } from "./windows.js";
import {
  ASK_WORDS,
  BOOKING_WORDS,
  CANCEL_WORDS,
  CLOCK_MARKS,
  MINE_WORDS,
  NOT_NOTE_WORDS,
  QUESTION_MARK,
  RANGE_ENDS,
  RANGE_JOINS,
  WEEKDAYS,
  WORK_WORDS,
} from "./words.js";

/**
 * What one message about the schedule asks (ADR 0048 §2, §3), read by code from the owner's own words: the action
 * from a word list, the day with the need interview's reader, the hours with `timeIn`, and the note as what is left.
 */

export const ScheduleAction = { save: "save", list: "list", cancel: "cancel" } as const;
export type ScheduleAction = (typeof ScheduleAction)[keyof typeof ScheduleAction];

export interface ScheduleAsk {
  action: ScheduleAction;
  /** "YYYY-MM-DD" or `EVERY_DAY`; for a save, always set. */
  day?: string;
  start_min?: number;
  end_min?: number;
  note?: string;
}

const SPECIAL = /[.*+?^${}()|[\]\\]/g;
/** Matches only whole words: "show" is not a question inside "shower". */
const wholeWords = (words: readonly string[]): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{M}])(?:${words.map((w) => normalize(w).replace(SPECIAL, "\\$&")).join("|")})(?![\\p{L}\\p{M}])`,
    "u",
  );
const ASKS = wholeWords(ASK_WORDS);
const MINE = wholeWords(MINE_WORDS);
const finders = (words: readonly string[]): Finder[] => words.map(finder);
const BOOKING = finders(BOOKING_WORDS);
const CANCEL = finders(CANCEL_WORDS);
const WORK = finders(WORK_WORDS);
const WEEKDAY_FINDERS = WEEKDAYS.map(finders);
const DAYS_PER_WEEK = 7;
/** Whether a day was said does not depend on which day it is; this one stands in for today when only that matters. */
const ANY_DAY = "2026-01-01";
/** Where one clause ends: the note is read from the first clause that has one ("…, put it down" adds nothing). */
const CLAUSE = /[,;।!?]|\.(?!\d)/u;

/** Words never in a note, wherever they stand: schedule words, days, months, parts of the day, clock words. */
const NEVER_NOTE: ReadonlySet<string> = new Set(
  [...BOOKING_WORDS, ...TOMORROW_WORDS, ...TODAY_WORDS, ...PART_OF_DAY, ...MONTHS.flat(), ...WEEKDAYS.flat()]
    .concat(RANGE_JOINS, RANGE_ENDS, CLOCK_MARKS)
    .map(normalize),
);
/** Words a note never starts or ends with: commands, small words and all of the above. */
const NOT_AT_EDGE: ReadonlySet<string> = new Set(NOT_NOTE_WORDS.map(normalize));
const HAS_LETTER = /[\p{L}]/u;
const TRAILING_MARKS = /[,.;:!?।]+$/u;

/**
 * True when the word lists hear the worker's schedule: a booking or work beside a time ("kal 2 se 3 kaam"), a booking
 * to cancel, or a question about their own bookings ("what's on my schedule?").
 */
export function soundsLikeSchedule(text: string): boolean {
  const said = normalize(text);
  const booking = firstIn(said, BOOKING) >= 0;
  if ((booking || firstIn(said, WORK) >= 0) && timeIn(text) !== undefined) return true;
  return booking && (firstIn(said, CANCEL) >= 0 || (ASKS.test(said) && MINE.test(said)));
}

/** The words name a booking: "change my booking time" is about that booking, not the card's hours. */
export const namesBooking = (text: string): boolean => firstIn(normalize(text), BOOKING) >= 0;

/** The next `weekday` (0 Sunday) from `today` on, today included: "on Saturday" said on a Saturday is today. */
function nextWeekday(today: string, weekday: number): string {
  const from = new Date(today).getUTCDay();
  return addDays(today, (weekday - from + DAYS_PER_WEEK) % DAYS_PER_WEEK);
}

/**
 * The words carry something the schedule acts on: a time, a booking or schedule word, or work on a day said. A model
 * that hears the schedule in words without any ("show my passbook") is not followed (ADR 0048 §2).
 */
export function hasScheduleCue(text: string): boolean {
  const said = normalize(text);
  if (timeIn(text) !== undefined || firstIn(said, BOOKING) >= 0) return true;
  return firstIn(said, WORK) >= 0 && dayOf(text, ANY_DAY) !== undefined;
}

/** The day said, as an ISO day or `EVERY_DAY`; today, tomorrow and a day of the week become dates. */
function dayOf(rest: string, today: string): string | undefined {
  const day = dayIn(rest, today);
  if (day === DayWord.today) return today;
  if (day === DayWord.tomorrow) return addDays(today, 1);
  if (day) return day;
  const said = normalize(rest);
  const weekday = WEEKDAY_FINDERS.findIndex((list) => firstIn(said, list) >= 0);
  return weekday < 0 ? undefined : nextWeekday(today, weekday);
}

/** The owner's own words about where or for whom, from the first clause that has any. */
const noteOf = (rest: string): string | undefined =>
  rest
    .split(CLAUSE)
    .map(clauseNote)
    .find((note) => note !== undefined);

/** One clause's note, once the command, the day and the time are taken out. */
function clauseNote(rest: string): string | undefined {
  const words = rest.split(/\s+/).filter((w) => w && !NEVER_NOTE.has(normalize(w)) && HAS_LETTER.test(w));
  const kept = (w: string) => !NOT_AT_EDGE.has(normalize(w));
  const first = words.findIndex(kept);
  if (first < 0) return undefined;
  const last = words.length - 1 - [...words].reverse().findIndex(kept);
  const note = words
    .slice(first, last + 1)
    .join(SPACE)
    .replace(TRAILING_MARKS, "");
  return note ? note.slice(0, BOOKING_NOTE_MAX) : undefined;
}

/** The action a message asks for: cancel words first, then a question, then a time to keep. */
function actionOf(text: string, hasTime: boolean): ScheduleAction {
  const said = normalize(text);
  if (firstIn(said, CANCEL) >= 0) return ScheduleAction.cancel;
  if (ASKS.test(said) || text.includes(QUESTION_MARK)) return ScheduleAction.list;
  return hasTime ? ScheduleAction.save : ScheduleAction.list;
}

/** What a message about the schedule asks, on the phone's own day and minute. */
export function readSchedule(text: string, now: LocalNow): ScheduleAsk {
  const said = clockText(text);
  const time = timeIn(text);
  // Offsets are into `said`; it has the owner's letters as typed whenever its length did not change.
  const base = said.length === text.length ? text : said;
  const rest = time ? `${base.slice(0, time.from)}${SPACE}${base.slice(time.to)}` : base;
  const action = actionOf(text, time !== undefined);
  const day = dayOf(rest, now.day);
  const hours = time ? { start_min: time.start_min, end_min: time.end_min } : {};
  if (action !== ScheduleAction.save || !time) return { action, ...(day ? { day } : {}), ...hours };
  // No day said: today, or tomorrow once that time has passed today.
  const on = day ?? (time.start_min > now.minute ? now.day : addDays(now.day, 1));
  const note = noteOf(rest);
  return { action, day: on, ...hours, ...(note ? { note } : {}) };
}
