import {
  DAY_HOURS,
  ISO_WEEKDAYS,
  type IsoWeekday,
  MAX_HOURS,
  MAX_RADIUS_KM,
  MaterialsBy,
  MIN_HOURS,
} from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { hourText } from "../i18n/terms-text.js";
import { range } from "../job/terms.js";
import type { TermPrefs } from "../job/worker-stance.js";
import { FIRST_HOUR, LAST_HOUR } from "../schedule/windows.js";
import { statedNumbers } from "./amount.js";
import {
  advance,
  type CardDraft,
  type Choice,
  type InterviewState,
  type Line,
  Pick,
  type Prompt,
  retry,
  Slot,
} from "./card.js";
import { anyHoursSaid, daysSaid, hoursSaid, materialsSaid } from "./card-words.js";

/**
 * What a worker's card says besides the price (ADR 0033 §3, ADR 0053 §1, §7), by chat: the hours and days they work,
 * how far they go, who buys the materials and the most hours a day. All but how far they go are asked only when the
 * owner wants them changed, so a first card stays short; a card without them works any time, as every card did.
 */

/**
 * How far a worker goes, in km (ADR 0045): asked right after the area, with these as quick chips and a slider over a
 * map of their area for any other distance up to the board's limit, which starts at `ASKED_RADIUS_KM`.
 */
export const RADII_KM = [5, 10] as const;
export const ASKED_RADIUS_KM = 10;
const FARTHEST_KM = MAX_RADIUS_KM;
/** The most-hours choices a worker taps; any other number within the limit may be said. */
export const MOST_HOURS = [4, 6, 8, 10] as const;
/** The latest a worker's day ends: one hour after the last start hour a household can pick. */
export const LAST_END = LAST_HOUR + 1;
const HOURS_PER_HALF_DAY = 12;

const MATERIALS_LABEL: Readonly<Record<MaterialsBy, MessageKey>> = {
  [MaterialsBy.enum.worker]: "terms.card_mine",
  [MaterialsBy.enum.household]: "terms.card_theirs",
};

/** The preferences with one field set, or left out when `value` is undefined. */
export function withTerm<K extends keyof TermPrefs>(
  prefs: TermPrefs,
  key: K,
  value: TermPrefs[K] | undefined,
): TermPrefs {
  const rest = Object.fromEntries(Object.entries(prefs).filter(([k]) => k !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}

/**
 * The preferences with the worker's hours on the clock set, or both cleared (any time). The parts of the day go: with
 * hours set they are derived from them (`workHoursOf`), and cleared the worker has said any time.
 */
export function withClock(prefs: TermPrefs, from?: number, to?: number): TermPrefs {
  const { from: _from, to: _to, windows: _windows, ...rest } = prefs;
  return from === undefined || to === undefined ? rest : { ...rest, from, to };
}

/** Asked again when no hours could be read, or the end is not after the start. */
const AGAIN_HOURS = { key: "iv.again.hours" } as const;

const prefsOf = (d: CardDraft): TermPrefs => d.terms ?? {};
const withPrefs = (d: CardDraft, terms: TermPrefs): CardDraft => ({ ...d, terms });
const hourChoice = (s: InterviewState, h: number): Choice => ({
  value: String(h),
  key: "when.hour",
  params: { time: hourText(s.config.own, h) },
});
const hoursLine = (key: MessageKey, s: InterviewState, from: number, to: number): Line => ({
  key,
  params: { from: hourText(s.config.own, from), to: hourText(s.config.own, to) },
});
const dayKeys = (days: readonly IsoWeekday[]) =>
  ISO_WEEKDAYS.filter((d) => days.includes(d)).map((d) => `day.${d}` as const);
const daysLine = (key: MessageKey, days: readonly IsoWeekday[]): Line => ({ key, names: { days: dayKeys(days) } });
const materialsLine = (m: MaterialsBy): Line => ({ key: "iv.got_materials", names: { who: [MATERIALS_LABEL[m]] } });
const within = (n: number, low: number, high: number) => n >= low && n <= high;

function keepHours(s: InterviewState, from: number, to: number): InterviewState {
  if (from >= to || to > DAY_HOURS) return retry(s, AGAIN_HOURS);
  const draft = withPrefs(s.draft, withClock(prefsOf(s.draft), from, to));
  return advance(s, draft, [hoursLine("iv.got_hours", s, from, to)]);
}

const anyHours = (s: InterviewState): InterviewState =>
  advance(s, withPrefs(s.draft, withClock(prefsOf(s.draft))), [{ key: "iv.got_any_hours" }]);

/** A start alone: the end is asked next. */
const startAt = (s: InterviewState, from: number): InterviewState => ({
  ...s,
  slot: Slot.hours_to,
  from,
  notes: [],
  misses: 0,
  fresh: false,
});

function hearHours(s: InterviewState, text: string): InterviewState {
  if (anyHoursSaid(text)) return anyHours(s);
  const said = hoursSaid(text);
  if (!said) return retry(s, AGAIN_HOURS);
  return said.to === undefined ? startAt(s, said.from) : keepHours(s, said.from, said.to);
}

/** The end of the day, as said: "6" after a start of 9 is 6 in the evening. */
function hearHoursTo(s: InterviewState, text: string): InterviewState {
  const from = s.from;
  const said = hoursSaid(text);
  if (from === undefined || !said) return retry(s, AGAIN_HOURS);
  const to = said.to ?? said.from;
  return keepHours(s, from, to > from ? to : to + HOURS_PER_HALF_DAY);
}

function keepDays(s: InterviewState, days: readonly IsoWeekday[]): InterviewState {
  const kept = ISO_WEEKDAYS.filter((d) => days.includes(d));
  const draft = withPrefs(s.draft, withTerm(prefsOf(s.draft), "days", kept.length > 0 ? kept : undefined));
  return advance(s, draft, [kept.length > 0 ? daysLine("iv.got_days", kept) : { key: "iv.got_every_day" }]);
}

function hearDays(s: InterviewState, text: string): InterviewState {
  const days = daysSaid(text);
  return days ? keepDays(s, days) : retry(s, { key: "iv.again.days" });
}

/** A chip: a day toggles, Every day and Done move on. None ticked means every day. */
function chooseDays(s: InterviewState, value: string): InterviewState {
  const days = prefsOf(s.draft).days ?? [];
  if (value === Pick.any) return keepDays(s, []);
  if (value === Pick.yes) return keepDays(s, days);
  const day = ISO_WEEKDAYS.find((d) => String(d) === value);
  if (!day) return s;
  const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
  const terms = withTerm(prefsOf(s.draft), "days", next.length > 0 ? next : undefined);
  return { ...s, draft: withPrefs(s.draft, terms), notes: [], fresh: false };
}

function keepRadius(s: InterviewState, km: number | undefined): InterviewState {
  if (km === undefined || !within(km, 1, FARTHEST_KM))
    return retry(s, { key: "iv.again.radius", params: { km: FARTHEST_KM } });
  return advance(s, { ...s.draft, radius_km: km }, [{ key: "iv.got_radius", params: { km } }]);
}

function keepMaterials(s: InterviewState, by: MaterialsBy | null | undefined): InterviewState {
  if (by === undefined) return retry(s, { key: "iv.again.materials" });
  const draft = withPrefs(s.draft, withTerm(prefsOf(s.draft), "materials", by ?? undefined));
  return advance(s, draft, by ? [materialsLine(by)] : [{ key: "iv.got_materials_any" }]);
}

function keepMaxHours(s: InterviewState, hours: number | undefined): InterviewState {
  if (hours === undefined || !within(hours, MIN_HOURS, MAX_HOURS))
    return retry(s, { key: "iv.again.max_hours", params: { max: MAX_HOURS } });
  const draft = withPrefs(s.draft, withTerm(prefsOf(s.draft), "max_hours", hours));
  return advance(s, draft, [{ key: "iv.got_max_hours", params: { hours } }]);
}

const anyMaxHours = (s: InterviewState): InterviewState =>
  advance(s, withPrefs(s.draft, withTerm(prefsOf(s.draft), "max_hours", undefined)), [{ key: "iv.got_any_max_hours" }]);

/** An answer in words to one of these questions; any other slot is left as it is. */
export function hearTerms(s: InterviewState, text: string): InterviewState {
  switch (s.slot) {
    case Slot.hours:
      return hearHours(s, text);
    case Slot.hours_to:
      return hearHoursTo(s, text);
    case Slot.days:
      return hearDays(s, text);
    case Slot.radius:
      return keepRadius(s, statedNumbers(text)[0]);
    case Slot.materials:
      return keepMaterials(s, materialsSaid(text));
    case Slot.max_hours:
      return anyHoursSaid(text) ? anyMaxHours(s) : keepMaxHours(s, statedNumbers(text)[0]);
    default:
      return s;
  }
}

/** An answer by tapping one of these questions' chips. A value the prompt did not offer changes nothing. */
export function chooseTerms(s: InterviewState, value: string): InterviewState {
  const n = Number(value);
  switch (s.slot) {
    case Slot.hours:
      if (value === Pick.any) return anyHours(s);
      return range(FIRST_HOUR, LAST_HOUR).includes(n) ? startAt(s, n) : s;
    case Slot.hours_to:
      return s.from !== undefined && range(s.from + 1, LAST_END).includes(n) ? keepHours(s, s.from, n) : s;
    case Slot.days:
      return chooseDays(s, value);
    case Slot.radius:
      // A chip, or the slider's own distance: any whole number of km within the board's limit.
      return Number.isInteger(n) ? keepRadius(s, n) : s;
    case Slot.materials: {
      if (value === Pick.any) return keepMaterials(s, null);
      return MaterialsBy.safeParse(value).success ? keepMaterials(s, MaterialsBy.parse(value)) : s;
    }
    case Slot.max_hours:
      if (value === Pick.any) return anyMaxHours(s);
      return MOST_HOURS.some((h) => h === n) ? keepMaxHours(s, n) : s;
    default:
      return s;
  }
}

/** The question for one of these slots. */
export function termsPrompt(s: InterviewState): Prompt {
  switch (s.slot) {
    case Slot.hours:
      return {
        lines: [{ key: "iv.ask.hours" }],
        choices: [
          ...range(FIRST_HOUR, LAST_HOUR).map((h) => hourChoice(s, h)),
          { value: Pick.any, key: "terms.card_any_hours" },
        ],
        hints: [],
      };
    case Slot.hours_to: {
      const from = s.from ?? FIRST_HOUR;
      return {
        lines: [{ key: "iv.ask.hours_to", params: { from: hourText(s.config.own, from) } }],
        choices: range(from + 1, LAST_END).map((h) => hourChoice(s, h)),
        hints: [],
      };
    }
    case Slot.days: {
      const days = prefsOf(s.draft).days ?? [];
      return {
        lines: [{ key: "iv.ask.days" }, ...(days.length > 0 ? [daysLine("iv.got_days", days)] : [])],
        choices: [
          ...ISO_WEEKDAYS.map((d) => ({ value: String(d), key: `day.${d}` as const })),
          { value: Pick.any, key: "iv.every_day" },
          { value: Pick.yes, key: "iv.done" },
        ],
        hints: [],
      };
    }
    case Slot.radius:
      return {
        lines: [{ key: "iv.ask.radius" }],
        choices: RADII_KM.map((km) => ({ value: String(km), key: "card.km", params: { km } })),
        numeric: true,
        hints: [],
      };
    case Slot.materials:
      return {
        lines: [{ key: "iv.ask.materials" }],
        choices: [
          ...MaterialsBy.options.map((m) => ({ value: m, key: MATERIALS_LABEL[m] })),
          { value: Pick.any, key: "terms.card_either" },
        ],
        hints: [],
      };
    case Slot.max_hours:
      return {
        lines: [{ key: "iv.ask.max_hours" }],
        choices: [
          ...MOST_HOURS.map((hours) => ({ value: String(hours), key: "iv.hours_n" as const, params: { hours } })),
          { value: Pick.any, key: "terms.card_any" },
        ],
        numeric: true,
        hints: [],
      };
    default:
      return { lines: [], hints: [] };
  }
}

/** These preferences in the card's summary, each only when the worker set it. */
export function termsSummary(s: InterviewState): Line[] {
  const { from, to, days, materials, max_hours } = prefsOf(s.draft);
  const { radius_km } = s.draft;
  return [
    ...(from !== undefined && to !== undefined ? [hoursLine("iv.summary_hours", s, from, to)] : []),
    ...(days?.length ? [daysLine("iv.summary_days", days)] : []),
    ...(radius_km !== undefined ? [{ key: "iv.summary_radius", params: { km: radius_km } } as const] : []),
    ...(materials ? [materialsLine(materials)] : []),
    ...(max_hours !== undefined ? [{ key: "iv.summary_max_hours", params: { hours: max_hours } } as const] : []),
  ];
}
