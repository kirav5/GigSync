import {
  DetailFlag,
  fitTerms,
  type JobTrade,
  MAX_COATS,
  MAX_HOURS,
  MaterialsBy,
  QuestionKey,
  TermKey,
  type Terms,
  TimeWindow,
} from "@gigsync/protocol";
import { asciiDigits, countIn } from "../job/details.js";
import type { NewNeed } from "../job/device.js";
import { timeIn } from "../schedule/clock.js";
import { AFTERNOON_FROM, EVENING_FROM, MINUTES_PER_HOUR, windowAt } from "../schedule/windows.js";
import { CLOCK_MARKS } from "../schedule/words.js";
import type { NeedDraft } from "./need.js";
import { draftDetails } from "./need-request.js";
import { scopeFlexible } from "./need-scope.js";
import { type Finder, finder, firstIn, normalize } from "./normalize.js";
import { AM_WORDS, PM_WORDS, WINDOW_WORDS } from "./scope-words.js";

/**
 * The terms a household asks for (ADR 0033 §3), from what it already said and confirmed in the need interview: the
 * day and the part of it, who buys the paint, coats and hours. Nothing is guessed: a time with no part of the day
 * and no am/pm sets no window, and a term the owner did not give is not asked for.
 */

const Q = QuestionKey.enum;
const WINDOW_FINDERS = TimeWindow.options.map((w) => [w, WINDOW_WORDS[w].map(finder)] as const);
const PM: Finder[] = PM_WORDS.map(finder);
const AM: Finder[] = AM_WORDS.map(finder);
const HOUR = /(?<!\d)(\d{1,2})(?!\d)/;
const escapeRe = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "10 30 am": minutes after a space, read as "10:30" only when am, pm or a clock word follows. */
const SPACED_MINUTES = new RegExp(
  `(?<!\\d)(\\d{1,2}) (\\d{2})(?=\\s*(?:${[...AM_WORDS, ...PM_WORDS, ...CLOCK_MARKS].map(escapeRe).join("|")}))`,
  "iu",
);
const NOON = 12;
const LAST_HOUR = 23;

/** The part of the day a time names: a word for it, or an hour said with am or pm; undefined otherwise. */
export function windowOf(time: string | undefined): TimeWindow | undefined {
  if (!time) return undefined;
  const said = asciiDigits(normalize(time));
  const named = WINDOW_FINDERS.find(([, list]) => firstIn(said, list) >= 0)?.[0];
  if (named) return named;
  const hour = Number(HOUR.exec(said)?.[1]);
  const pm = firstIn(said, PM) >= 0;
  if (!Number.isInteger(hour) || (!pm && firstIn(said, AM) < 0)) return undefined;
  const clock = pm && hour < NOON ? hour + NOON : hour % NOON === 0 && !pm ? 0 : hour;
  if (clock > LAST_HOUR) return undefined;
  if (clock >= EVENING_FROM) return TimeWindow.enum.evening;
  return clock >= AFTERNOON_FROM ? TimeWindow.enum.afternoon : TimeWindow.enum.morning;
}

/** The hour on the clock a time names ("2 pm", "दोपहर 2 बजे", "kal 10 baje"); undefined when it names none. */
export function hourOf(time: string | undefined): number | undefined {
  const read = time ? timeIn(time.replace(SPACED_MINUTES, "$1:$2")) : undefined;
  return read && Math.floor(read.start_min / MINUTES_PER_HOUR);
}

/** The time of a need whose household said any time that day is fine: asked, and nothing to read a window from. */
export const ANY_TIME = "";

/**
 * The day is set and the household has not said the hour: the hour is asked next (ADR 0053 §1). A part of the day
 * alone ("tomorrow morning") still asks it, among that part's hours; "any time" does not.
 */
export const needsHour = (d: NeedDraft): boolean =>
  d.day !== undefined && (d.time === undefined || (d.time !== ANY_TIME && hourOf(d.time) === undefined));

/** A count the protocol allows (1 to `max`), else undefined. */
const within = (n: number | undefined, max: number) => (n !== undefined && n >= 1 && n <= max ? n : undefined);

/**
 * The household's terms for a need on `day` (an ISO day or every day): only what its owner said or confirmed, and
 * only the terms its trade negotiates.
 */
export function needTerms(d: NeedDraft, trade: JobTrade, day: string): Pick<NewNeed, "terms" | "flexible"> {
  const details = { ...d.seen, ...draftDetails(d) };
  // A start hour when the owner gave one (ADR 0053 §1); its part of the day goes with it, for older phones.
  const hour = hourOf(d.time);
  const window = hour !== undefined ? windowAt(hour) : windowOf(d.time);
  const labour = DetailFlag.safeParse(details[Q.labour_only]).data;
  const coats = within(countIn(details[Q.coats]), MAX_COATS);
  const hours = within(countIn(details[Q.hours]), MAX_HOURS);
  const terms: Terms = fitTerms(trade, {
    ...(window ? { when: { day, window, ...(hour !== undefined ? { hour } : {}) } } : {}),
    ...(labour
      ? { materials: labour === DetailFlag.enum.yes ? MaterialsBy.enum.household : MaterialsBy.enum.worker }
      : {}),
    ...(coats ? { coats } : {}),
    ...(hours ? { hours } : {}),
  });
  const flexible = scopeFlexible(d) && terms.when ? [TermKey.enum.when] : [];
  return { ...(Object.keys(terms).length > 0 ? { terms } : {}), ...(flexible.length > 0 ? { flexible } : {}) };
}
