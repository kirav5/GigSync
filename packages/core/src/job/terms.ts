import {
  EVERY_DAY,
  ISO_WEEKDAYS,
  type IsoWeekday,
  isoWeekday,
  type JobTrade,
  MAX_COATS,
  MAX_HOURS,
  MaterialsBy,
  MIN_COATS,
  MIN_HOURS,
  TermKey,
  Terms,
  type TermWhen,
  TimeWindow,
  TRADE_TERMS,
  type WorkHours,
} from "@gigsync/protocol";

/**
 * Negotiating the terms other than price (ADR 0033 §3), as plain data: each side has a stance (its own first choice
 * per term, and which values it accepts), and answers the other side's proposal term by term. A term it accepts is
 * kept as proposed; for one it does not, code lists the valid counter-proposals, closest to the other side's value
 * first, and a model may choose among them (`terms-model.ts`), never outside them. Nothing here sets a price.
 */

const K = TermKey.enum;
/** How many days after the asked day a counter-proposal may move the work. */
export const DAYS_AHEAD = 3;
/** At most this many counter-proposals per term are offered to the model to choose from. */
export const MAX_OPTIONS = 3;
const MS_PER_DAY = 86_400_000;
const ISO_DAY_LENGTH = 10;
const WINDOWS = TimeWindow.options;

/** The value one term holds, by its key. */
export type TermValue<T extends TermKey> = NonNullable<Terms[T]>;
type Accepts = { [T in TermKey]: (value: TermValue<T>) => boolean };

/** One side's position on the terms: its own first choice per term, and which values it accepts. Never sent. */
export interface Stance {
  wants: Terms;
  accepts: Accepts;
}

/** The valid counter-proposals code generated for each term this side did not accept, closest first. */
export type TermOptions = { [T in TermKey]?: TermValue<T>[] };

export interface TermsAnswer {
  /** The terms this side proposes next. */
  next: Terms;
  /** Counter-proposals per countered term (at most `MAX_OPTIONS`); `next` holds the first of each. */
  options: TermOptions;
  /** Every term of the other side's proposal is acceptable as it is, and this side adds none. */
  agreed: boolean;
  /** Terms this side cannot accept at any nearby value and has no choice of its own for: no deal on them. */
  stuck: TermKey[];
}

/** A worker's own preferences for terms, set on their card: when they work, who buys materials, a day's hours. */
export interface TermPrefs {
  /** Parts of the day they take work in; every part when unset. */
  windows?: TimeWindow[];
  /** ISO weekdays they work (1 Monday … 7 Sunday); every day when unset. On the card's public hours (ADR 0050). */
  days?: IsoWeekday[];
  /** Who they want to buy the materials; either when unset. */
  materials?: MaterialsBy;
  /** The most hours a day they take on; any when unset. */
  max_hours?: number;
}

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(iso) + days * MS_PER_DAY).toISOString().slice(0, ISO_DAY_LENGTH);
const dayGap = (a: string, b: string): number =>
  a === EVERY_DAY || b === EVERY_DAY ? 0 : Math.round((Date.parse(a) - Date.parse(b)) / MS_PER_DAY);
const windowGap = (a: TimeWindow, b: TimeWindow) => Math.abs(WINDOWS.indexOf(a) - WINDOWS.indexOf(b));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Two values of one term are the same proposal. */
export function sameTerm<T extends TermKey>(key: T, a: Terms[T], b: Terms[T]): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (key !== K.when) return a === b;
  const [x, y] = [a as TermWhen, b as TermWhen];
  return x.day === y.day && x.window === y.window;
}

/** Every value a term could take near `around`, with how far each is from it; the day only moves later. */
function candidates<T extends TermKey>(key: T, around: TermValue<T>): { value: TermValue<T>; gap: number }[] {
  const all = (values: unknown[], gap: (v: never) => number) =>
    values.map((value) => ({ value: value as TermValue<T>, gap: gap(value as never) }));
  switch (key) {
    case K.when: {
      const w = around as TermWhen;
      const days = w.day === EVERY_DAY ? [EVERY_DAY] : range(0, DAYS_AHEAD).map((d) => addDays(w.day, d));
      const whens = days.flatMap((day) => WINDOWS.map((window) => ({ day, window })));
      return all(whens, (v: TermWhen) => dayGap(v.day, w.day) * WINDOWS.length + windowGap(v.window, w.window));
    }
    case K.materials:
      return all(MaterialsBy.options, (v: MaterialsBy) => (v === around ? 0 : 1));
    case K.coats:
      return all(range(MIN_COATS, MAX_COATS), (v: number) => Math.abs(v - (around as number)));
    default:
      return all(range(MIN_HOURS, MAX_HOURS), (v: number) => Math.abs(v - (around as number)));
  }
}

/** The values this side accepts other than `theirs`, closest to it first, at most `MAX_OPTIONS`. */
export function counterOptions<T extends TermKey>(key: T, theirs: TermValue<T>, stance: Stance): TermValue<T>[] {
  const accepts = stance.accepts[key] as (v: TermValue<T>) => boolean;
  return candidates(key, theirs)
    .filter((c) => !sameTerm(key, c.value, theirs) && accepts(c.value))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, MAX_OPTIONS)
    .map((c) => c.value);
}

/** Whether this side accepts `value` for `key`. */
const accepted = <T extends TermKey>(stance: Stance, key: T, value: TermValue<T>): boolean =>
  (stance.accepts[key] as (v: TermValue<T>) => boolean)(value);

/**
 * This side's answer to the other side's proposal, for each term the trade negotiates: kept when acceptable, else
 * countered with the closest acceptable value (or this side's own choice, when nothing near is acceptable; `stuck`
 * when it has none). A term the other side left out is proposed only when this side wants one.
 */
export function answerTerms(trade: JobTrade, stance: Stance, theirs: Terms | undefined): TermsAnswer {
  const next: Record<string, unknown> = {};
  const options: Record<string, unknown[]> = {};
  const stuck: TermKey[] = [];
  let agreed = true;
  for (const key of TRADE_TERMS[trade]) {
    const proposed = theirs?.[key];
    const want = stance.wants[key];
    if (proposed === undefined) {
      if (want !== undefined) [next[key], agreed] = [want, false];
      continue;
    }
    if (accepted(stance, key, proposed)) {
      next[key] = proposed;
      continue;
    }
    agreed = false;
    const counters = counterOptions(key, proposed, stance);
    if (counters.length > 0) options[key] = counters;
    else if (want === undefined) stuck.push(key);
    next[key] = counters[0] ?? want ?? proposed;
  }
  return { next: Terms.parse(next), options: options as TermOptions, agreed, stuck };
}

/** A value one step from another: the same day or the next, one coat or one hour either way. */
function near<T extends TermKey>(key: T, a: TermValue<T>, b: TermValue<T>): boolean {
  if (key === K.when) return Math.abs(dayGap((a as TermWhen).day, (b as TermWhen).day)) <= 1;
  if (key === K.materials) return true;
  return Math.abs((a as number) - (b as number)) <= 1;
}

/**
 * The household's stance, from its owner's own words and chips. A term the owner did not mention, anything goes;
 * one they did, only their value, or a value near it when they said they are flexible about it. A value the worker's
 * agent proposes a second time running is taken too: it is firm, and the owner decides when signing, never the agent
 * (`mustReview`).
 */
export function householdStance(wants: Terms, flexible: readonly TermKey[], workerBefore?: Terms): Stance {
  const accepts = <T extends TermKey>(key: T) =>
    ((value: TermValue<T>) => {
      const want = wants[key];
      if (want === undefined || sameTerm(key, value, want)) return true;
      if (flexible.includes(key) && near(key, value, want as TermValue<T>)) return true;
      return sameTerm(key, value, workerBefore?.[key]);
    }) as Accepts[T];
  return {
    wants,
    accepts: {
      when: accepts(K.when),
      materials: accepts(K.materials),
      coats: accepts(K.coats),
      hours: accepts(K.hours),
    },
  };
}

/**
 * The worker's stance, from their card's preferences and the work they have already agreed: a window they take work
 * in that is not booked, the materials they asked for, no more than their hours. Any number of coats: the price
 * follows them through the scope (`termDetails`). With a day to work on and preferred windows, they propose the first
 * free window when the household named none.
 */
export function workerStance(prefs: TermPrefs | undefined, booked: readonly TermWhen[], day?: string): Stance {
  const windows = prefs?.windows?.length ? prefs.windows : WINDOWS;
  // A day the worker does not work (ADR 0050 §2) is never free; work every day is judged by its window alone.
  const workDay = (d: string) => !prefs?.days?.length || d === EVERY_DAY || prefs.days.includes(isoWeekday(d));
  const free = (w: TermWhen) => workDay(w.day) && windows.includes(w.window) && !booked.some((b) => clashes(b, w));
  const first = day && prefs?.windows?.length ? windows.map((window) => ({ day, window })).find(free) : undefined;
  const maxHours = prefs?.max_hours ?? MAX_HOURS;
  return {
    wants: {
      ...(first ? { when: first } : {}),
      ...(prefs?.materials ? { materials: prefs.materials } : {}),
    },
    accepts: {
      when: free,
      materials: (m) => prefs?.materials === undefined || m === prefs.materials,
      coats: () => true,
      hours: (h) => h <= maxHours,
    },
  };
}

/** Two times overlap: the same window on the same day, or on any day for work done every day. */
export const clashes = (a: TermWhen, b: TermWhen): boolean =>
  a.window === b.window && (a.day === b.day || a.day === EVERY_DAY || b.day === EVERY_DAY);

/** The terms the owner asked for that the agreed terms change: the owner signs those themselves. */
export function changedFromWants(wants: Terms, agreed: Terms | undefined): TermKey[] {
  return TermKey.options.filter((key) => wants[key] !== undefined && !sameTerm(key, agreed?.[key], wants[key]));
}

/**
 * The working hours a card shows (ADR 0050 §2), from the worker's preferences: the days and parts of the day they
 * take work, each every one when only the other is set; none when they set neither, which works any time.
 */
export function workHoursOf(prefs: TermPrefs | undefined): WorkHours | undefined {
  if (!prefs?.days?.length && !prefs?.windows?.length) return undefined;
  return {
    days: prefs.days?.length ? [...prefs.days] : [...ISO_WEEKDAYS],
    windows: prefs.windows?.length ? [...prefs.windows] : [...TimeWindow.options],
  };
}
