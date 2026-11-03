import { PAISE_PER_RUPEE, QuestionKey, Trade } from "@gigsync/protocol";
import { asciiDigits } from "../job/details.js";
import { EVERY_DAY } from "../job/when.js";
import { parseAmount } from "./amount.js";
import type { AreaChoice } from "./card.js";
import { areaNamedIn, tradesIn } from "./lexicon.js";
import { DayWord } from "./need.js";
import {
  CLOCK_WORDS,
  COUNT_WORDS,
  DAILY_WORDS,
  DAY_AFTER_WORDS,
  MONEY_CUES,
  MONTHS,
  OBJECT_TRADES,
  PART_OF_DAY,
  PROBLEM_WORDS,
  TODAY_WORDS,
  TOMORROW_WORDS,
} from "./need-words.js";
import { type Finder, finder, firstIn, normalize, SPACE } from "./normalize.js";

/**
 * Reading one free sentence about a need, in Hindi, Kannada, English or a mix, without a model: the trade, the area,
 * the day and time, a budget, and details a worker's agent would otherwise ask. Whatever it cannot read stays empty
 * for the interview to ask. "Models propose, code decides": a model may fill gaps after this (`need-model.ts`), never
 * replace it.
 */

/** What one sentence said; every field is optional. */
export interface NeedFill {
  trade?: Trade;
  area?: string;
  day?: string;
  time?: string;
  budget_paise?: number;
  details: Partial<Record<QuestionKey, string>>;
  /** The sentence without its budget: the words that may go to workers. Empty when nothing else was said. */
  words: string;
}

export interface NeedParseOptions {
  areas: readonly AreaChoice[];
  /** The phone's calendar day, "YYYY-MM-DD", for "day after tomorrow" and dates without a year. */
  today: string;
}

/** `JobRequest.when` holds at most 100 characters: the day's words, then this much time text. */
export const TIME_MAX = 60;
/** What a request keeps of one detail (`JobRequest.details` values). */
export const DETAIL_MAX = 300;
/** A sentence's lone number below this is a count or a distance, not a budget. */
const MIN_STATED_BUDGET_PAISE = 50 * PAISE_PER_RUPEE;
const DAYS_AFTER_TOMORROW = 2;
const MS_PER_DAY = 86_400_000;
const ISO_DAY_LENGTH = 10;
const CENTURY = 2000;
const TWO_DIGIT_YEAR = 100;

/** Regular expression flags: Unicode, and Unicode for every match. */
const Flags = { one: "u", all: "gu" } as const;
const SPECIAL = /[.*+?^${}()|[\]\\]/g;
const alternatives = (words: readonly string[]) =>
  [...words]
    .map((w) => normalize(w).replace(SPECIAL, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|");
const NOT_AFTER_DIGIT = "(?<!\\d)";
const WORD_END = "(?![\\p{L}\\p{M}])";
const CLOCK = new RegExp(
  `${NOT_AFTER_DIGIT}\\d{1,2}(?:[ .]\\d{2})?\\s?(?:${alternatives(CLOCK_WORDS)})${WORD_END}`,
  Flags.all,
);
const MONTH_NAMES = MONTHS.map((names) => alternatives(names));
const MONTH_ANY = `(${MONTH_NAMES.join("|")})`;
const DAY_THEN_MONTH = new RegExp(
  `${NOT_AFTER_DIGIT}(\\d{1,2})(?:st|nd|rd|th)?\\s(?:of\\s)?${MONTH_ANY}${WORD_END}`,
  Flags.one,
);
const MONTH_THEN_DAY = new RegExp(`(?<![\\p{L}\\p{M}])${MONTH_ANY}\\s(\\d{1,2})(?!\\d)`, Flags.one);
const MONTH_DATES = [DAY_THEN_MONTH, MONTH_THEN_DAY].map((date) => new RegExp(date.source, Flags.all));
const MONTH_MATCHERS = MONTH_NAMES.map((alt) => new RegExp(`^(?:${alt})$`, Flags.one));
/** Where one clause of a sentence ends: a comma, a stop (not a decimal point), a danda, a line. */
const CLAUSE_END = /([,;।!?\n]|\.(?!\d))/;
/** A comma or stop left dangling at the end once a clause after it is dropped. */
const TRAILING_MARK = /[,;]+$/;
/** "5/11", "05-11-2026", "5.11.26": day first, as dates are written in India. */
const NUMERIC_DATE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?!\d)/;
const NUMERIC_DATES = new RegExp(NUMERIC_DATE.source, "g");
const COUNTS = Object.entries(COUNT_WORDS).map(
  ([key, words]) => [key, new RegExp(`${NOT_AFTER_DIGIT}\\d+\\s?(?:${alternatives(words ?? [])})`, Flags.one)] as const,
);
const COUNTS_ALL = Object.values(COUNT_WORDS).map(
  (words) => new RegExp(`${NOT_AFTER_DIGIT}\\d+\\s?(?:${alternatives(words ?? [])})`, Flags.all),
);

const finders = (words: readonly string[]): Finder[] => words.map(finder);
const TOMORROW = finders(TOMORROW_WORDS);
const TODAY = finders(TODAY_WORDS);
const DAY_AFTER = finders(DAY_AFTER_WORDS);
const DAILY = finders(DAILY_WORDS);
const MONEY = finders(MONEY_CUES);
const PROBLEM = finders(PROBLEM_WORDS);
const PARTS = PART_OF_DAY.map((w) => [normalize(w), finder(w)] as const);
const OBJECTS = Trade.options.map((tr) => [tr, finders(OBJECT_TRADES[tr] ?? [])] as const);

/** The trade a sentence names, else the one that fixes the first broken thing it names. */
function tradeIn(text: string): Trade | undefined {
  const named = tradesIn(text)[0];
  if (named) return named;
  const said = prepared(text);
  return OBJECTS.map(([tr, list]) => [tr, firstIn(said, list)] as const)
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])[0]?.[0];
}

const prepared = (text: string) => asciiDigits(normalize(text));

/** The day `days` after an ISO day, as "YYYY-MM-DD". */
export const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(iso) + days * MS_PER_DAY).toISOString().slice(0, ISO_DAY_LENGTH);

/** A real calendar day as ISO, or undefined ("31/2" is not a date). */
function isoOf(year: number, month: number, day: number): string | undefined {
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return undefined;
  return at.toISOString().slice(0, ISO_DAY_LENGTH);
}

/** A date without a year is the next one to come; one with a year must not be past. */
function upcoming(today: string, month: number, day: number, year?: number): string | undefined {
  if (year !== undefined) {
    const iso = isoOf(year < TWO_DIGIT_YEAR ? CENTURY + year : year, month, day);
    return iso !== undefined && iso >= today ? iso : undefined;
  }
  const thisYear = Number(today.slice(0, 4));
  const iso = isoOf(thisYear, month, day);
  if (iso === undefined || iso >= today) return iso;
  return isoOf(thisYear + 1, month, day);
}

/** A date written in digits or with a month's name. */
function dateIn(text: string, today: string): string | undefined {
  const numeric = NUMERIC_DATE.exec(asciiDigits(text));
  if (numeric) {
    const year = numeric[3] === undefined ? undefined : Number(numeric[3]);
    return upcoming(today, Number(numeric[2]), Number(numeric[1]), year);
  }
  const said = prepared(text);
  const monthOf = (name: string) => MONTH_MATCHERS.findIndex((m) => m.test(name)) + 1;
  const dm = DAY_THEN_MONTH.exec(said);
  if (dm?.[1] && dm[2]) return upcoming(today, monthOf(dm[2]), Number(dm[1]));
  const md = MONTH_THEN_DAY.exec(said);
  if (md?.[1] && md[2]) return upcoming(today, monthOf(md[1]), Number(md[2]));
  return undefined;
}

/** The day a sentence names: a day word, every day, or a date. */
export function dayIn(text: string, today: string): string | undefined {
  const said = prepared(text);
  if (firstIn(said, DAY_AFTER) >= 0) return addDays(today, DAYS_AFTER_TOMORROW);
  if (firstIn(said, DAILY) >= 0) return EVERY_DAY;
  if (firstIn(said, TOMORROW) >= 0) return DayWord.tomorrow;
  if (firstIn(said, TODAY) >= 0) return DayWord.today;
  return dateIn(text, today);
}

/** The time as said: clock times and parts of the day, in the order said ("सुबह 10 बजे"). */
export function timeIn(text: string): string | undefined {
  const said = prepared(text);
  const clocks = [...said.matchAll(CLOCK)].map((m) => ({ at: m.index, words: m[0] }));
  const parts = PARTS.map(([words, find]) => ({ at: find(said), words })).filter((p) => p.at >= 0);
  const all = [...clocks, ...parts].sort((a, b) => a.at - b.at).map((p) => p.words);
  return all.length > 0 ? all.join(SPACE).slice(0, TIME_MAX) : undefined;
}

/**
 * An amount in rupees, as paise, once dates, clock times and counts are taken out of the sentence. `needsCue` is for
 * a free sentence: only a number beside a money word counts there. Asked the budget outright, any amount counts.
 */
export function amountIn(text: string, needsCue: boolean): number | undefined {
  let said = prepared(asciiDigits(text).replace(NUMERIC_DATES, SPACE)).replace(CLOCK, SPACE);
  for (const count of COUNTS_ALL) said = said.replace(count, SPACE);
  for (const date of MONTH_DATES) said = said.replace(date, SPACE);
  if (needsCue && firstIn(said, MONEY) < 0) return undefined;
  const paise = parseAmount(said);
  const least = needsCue ? MIN_STATED_BUDGET_PAISE : 1;
  return paise !== undefined && paise >= least ? paise : undefined;
}

/**
 * The owner's words without the clauses that carry their budget: these words go to the workers, and the budget must
 * never leave the phone. "Fan not working, up to 700" keeps "Fan not working".
 */
export function withoutMoney(text: string): string {
  const parts = text.split(CLAUSE_END);
  let kept = "";
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i] ?? "";
    if (amountIn(clause, true) === undefined) kept += clause + (parts[i + 1] ?? "");
  }
  return kept.trim().replace(TRAILING_MARK, "").trim();
}

/** Details the sentence answers: the problem in its own words, and counts said with what they count. */
function detailsIn(text: string, words: string): Partial<Record<QuestionKey, string>> {
  const said = prepared(text);
  const details: Partial<Record<QuestionKey, string>> = {};
  if (words && firstIn(prepared(words), PROBLEM) >= 0 && words.length <= DETAIL_MAX)
    details[QuestionKey.enum.problem] = words;
  for (const [key, pattern] of COUNTS) {
    const found = pattern.exec(said)?.[0];
    const question = QuestionKey.safeParse(key);
    if (found && question.success) details[question.data] = found;
  }
  return details;
}

/** The job a sentence names: its trade, its area and its details, without the day, the time or the budget. */
export type JobFill = Pick<NeedFill, "trade" | "area" | "details" | "words">;

/** The job one sentence names, as a market question reads it: "painting a 2BHK in Jayanagar" is a painter's job. */
export function jobIn(text: string, areas: readonly AreaChoice[]): JobFill {
  const trade = tradeIn(text);
  const area = areaNamedIn(text, areas);
  const words = withoutMoney(text);
  return { ...(trade ? { trade } : {}), ...(area ? { area } : {}), details: detailsIn(text, words), words };
}

/** Everything one sentence about a need gives: "bedroom fan not working, need an electrician tomorrow morning, up to 700". */
export function parseNeed(text: string, { areas, today }: NeedParseOptions): NeedFill {
  const { trade, area, details, words } = jobIn(text, areas);
  const day = dayIn(text, today);
  const time = timeIn(text);
  const budget_paise = amountIn(text, true);
  return {
    ...(trade ? { trade } : {}),
    ...(area ? { area } : {}),
    ...(day ? { day } : {}),
    ...(time ? { time } : {}),
    ...(budget_paise ? { budget_paise } : {}),
    details,
    words,
  };
}
