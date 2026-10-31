import {
  DriverKind,
  DriverName,
  type DriverValues,
  driverSpec,
  MaidFrequency,
  MaterialsBy,
  QuestionKey,
  Surface,
  TRADE_DRIVERS,
  type Trade,
} from "@gigsync/protocol";
import { asciiDigits, countIn } from "../job/details.js";
import {
  type ChoiceWords,
  DAYS_WEEK_PATTERNS,
  DONT_KNOW_WORDS,
  DRIVER_COUNT_WORDS,
  DUPLEX_FLOORS,
  DUPLEX_WORDS,
  FINISH_WORDS,
  GROUND_PLUS,
  HOUSE_WORDS,
  PROBLEM_KIND_WORDS,
  ROOMS_WORDS,
  SURFACE_WORDS,
  TASK_WORDS,
  VEHICLE_WORDS,
} from "./driver-words.js";
import { yesNo } from "./lexicon.js";
import { COUNT_WORDS } from "./need-words.js";
import { type Finder, finder, firstIn, normalize } from "./normalize.js";
import { FREQUENCY_WORDS, LABOUR_ONLY_WORDS, SCOPE_COUNT_WORDS, WITH_PAINT_WORDS } from "./scope-words.js";

/**
 * Reading a household's words into price drivers (ADR 0041 §2), on the phone and without a model: "4 BHK villa,
 * outside too, 2 floors" gives rooms 4, house type villa, both surfaces and two floors. Only structured values leave
 * the phone; the words stay where they were said.
 */

const D = DriverName.enum;
const Q = QuestionKey.enum;
const SPECIAL = /[.*+?^${}()|[\]\\]/g;
const NOT_AFTER_DIGIT = "(?<!\\d)";
/** "3,000" and "1,20,000" as one number. */
const DIGIT_COMMA = /(?<=\d),(?=\d)/g;

const finders = (words: readonly string[]): Finder[] => words.map(finder);
const choiceFinders = (words: ChoiceWords) => words.map(([value, list]) => [value, finders(list)] as const);

const CHOICES: Readonly<Partial<Record<DriverName, ReturnType<typeof choiceFinders>>>> = {
  [D.surface]: choiceFinders(SURFACE_WORDS),
  [D.house_type]: choiceFinders(HOUSE_WORDS),
  [D.finish]: choiceFinders(FINISH_WORDS),
  [D.tasks]: choiceFinders(TASK_WORDS),
  [D.vehicle]: choiceFinders(VEHICLE_WORDS),
  [D.problem]: choiceFinders(PROBLEM_KIND_WORDS),
  [D.frequency]: choiceFinders(MaidFrequency.options.map((f) => [f, FREQUENCY_WORDS[f]] as const)),
  [D.paint_by]: choiceFinders([
    [MaterialsBy.enum.household, LABOUR_ONLY_WORDS],
    [MaterialsBy.enum.worker, WITH_PAINT_WORDS],
  ]),
};

/** The words after a count, per count driver: the need interview's lists and the drivers' own. */
const COUNT_LISTS: Readonly<Partial<Record<DriverName, readonly string[] | undefined>>> = {
  [D.rooms]: [...(COUNT_WORDS[Q.rooms] ?? []), ...ROOMS_WORDS],
  [D.people]: COUNT_WORDS[Q.people],
  [D.area_sqft]: COUNT_WORDS[Q.area_sqft],
  [D.meals]: SCOPE_COUNT_WORDS[Q.meals],
  [D.hours]: SCOPE_COUNT_WORDS[Q.hours],
  ...DRIVER_COUNT_WORDS,
};
const COUNTS = Object.entries(COUNT_LISTS).map(([name, words]) => {
  const alt = (words ?? []).map((w) => normalize(w).replace(SPECIAL, "\\$&")).join("|");
  return [name, new RegExp(`${NOT_AFTER_DIGIT}(\\d+)\\s?(?:${alt})`, "u")] as const;
});
const DONT_KNOW = finders(DONT_KNOW_WORDS);
const DUPLEX = finders(DUPLEX_WORDS);

const prepared = (text: string) => asciiDigits(normalize(text)).replace(DIGIT_COMMA, "");

/** A count kept only inside the driver's limits for the trade. */
function bounded(trade: Trade, name: DriverName, n: number | undefined): number | undefined {
  const spec = driverSpec(trade, name);
  return spec?.kind === DriverKind.count && n !== undefined && n >= spec.min && n <= spec.max ? n : undefined;
}

/** The first value of a choice driver the words name, among the values the trade allows. */
function choiceIn(trade: Trade, name: DriverName, said: string): string | undefined {
  const spec = driverSpec(trade, name);
  const list = CHOICES[name];
  if (spec?.kind !== DriverKind.choice || !list) return undefined;
  const found = list.find(([value, words]) => spec.values.includes(value) && firstIn(said, words) >= 0)?.[0];
  if (name !== D.surface || found !== Surface.enum.outside) return found;
  // "inside" said apart from "outside" ("inside, and the outside walls") is both.
  return list.some(([value, words]) => value === Surface.enum.inside && firstIn(said, words) >= 0)
    ? Surface.enum.both
    : found;
}

function countDriverIn(trade: Trade, name: DriverName, said: string): number | undefined {
  const pattern = COUNTS.find(([n]) => n === name)?.[1];
  const n = pattern ? Number(pattern.exec(said)?.[1]) : undefined;
  if (name === D.days_week) {
    const days = DAYS_WEEK_PATTERNS.map((p) => p.exec(said)?.[1]).find((d) => d !== undefined);
    return bounded(trade, name, days === undefined ? undefined : Number(days));
  }
  if (name === D.floors && !Number.isInteger(n)) {
    const ground = GROUND_PLUS.exec(said)?.[1];
    if (ground !== undefined) return bounded(trade, name, Number(ground) + 1);
    return firstIn(said, DUPLEX) >= 0 ? DUPLEX_FLOORS : undefined;
  }
  return Number.isInteger(n) ? bounded(trade, name, n) : undefined;
}

/** One driver read from already prepared words. */
function driverIn(trade: Trade, name: DriverName, said: string): string | number | undefined {
  const spec = driverSpec(trade, name);
  if (!spec) return undefined;
  return spec.kind === DriverKind.choice ? choiceIn(trade, name, said) : countDriverIn(trade, name, said);
}

/** Every driver of the trade the words give. */
export function driversIn(text: string, trade: Trade): DriverValues {
  const said = prepared(text);
  const out: DriverValues = {};
  for (const name of TRADE_DRIVERS[trade]) {
    const value = driverIn(trade, name, said);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** The owner said they do not know. */
export const saysDontKnow = (text: string): boolean => firstIn(prepared(text), DONT_KNOW) >= 0;

/** What an answer to one driver question gave. */
export type DriverAnswer = { value: string | number } | { dontKnow: true } | undefined;

/**
 * An answer to the question about one driver: "I don't know" first (its "नहीं" is not a no), then the driver's own
 * words, then a bare number for a count ("3000"), then a yes or no for who buys the paint ("will you buy it?").
 */
export function driverAnswer(trade: Trade, name: DriverName, text: string): DriverAnswer {
  if (saysDontKnow(text)) return { dontKnow: true };
  const spec = driverSpec(trade, name);
  const exact = spec?.kind === DriverKind.choice ? spec.values.find((v) => v === text.trim()) : undefined;
  if (exact) return { value: exact };
  const said = prepared(text);
  const value = driverIn(trade, name, said) ?? bareCount(trade, name, said) ?? paintByYesNo(name, text);
  return value === undefined ? undefined : { value };
}

const bareCount = (trade: Trade, name: DriverName, said: string): number | undefined =>
  driverSpec(trade, name)?.kind === DriverKind.count ? bounded(trade, name, countIn(said)) : undefined;

function paintByYesNo(name: DriverName, text: string): string | undefined {
  if (name !== D.paint_by) return undefined;
  const yes = yesNo(text);
  if (yes === undefined) return undefined;
  return yes ? MaterialsBy.enum.household : MaterialsBy.enum.worker;
}
