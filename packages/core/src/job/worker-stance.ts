import {
  EVERY_DAY,
  ISO_WEEKDAYS,
  type IsoWeekday,
  isoWeekday,
  MAX_HOURS,
  type MaterialsBy,
  type TermWhen,
  TimeWindow,
  type WorkHours,
} from "@gigsync/protocol";
import { atHour, type Hours, MINUTES_PER_HOUR, overlaps, spanOf, whenPassed, windowsOf } from "../schedule/windows.js";
import { range, type Stance, WINDOWS } from "./terms.js";

/**
 * The worker's side of the terms (ADR 0033 §3, ADR 0050 §2, ADR 0053 §1): their own preferences from their card, the
 * stance their agent takes from them and the time they have already given, and the hours their public card shows.
 */

/** A worker's own preferences for terms, set on their card: when they work, who buys materials, a day's hours. */
export interface TermPrefs {
  /** Parts of the day they take work in; every part when unset. Older cards' hours, and what `from`–`to` touches. */
  windows?: TimeWindow[];
  /** The hours of the day they work, on the clock (ADR 0053 §1): start hours from `from` until before `to`. */
  from?: number;
  to?: number;
  /** ISO weekdays they work (1 Monday … 7 Sunday); every day when unset. On the card's public hours (ADR 0050). */
  days?: IsoWeekday[];
  /** Who they want to buy the materials; either when unset. */
  materials?: MaterialsBy;
  /** The most hours a day they take on; any when unset. */
  max_hours?: number;
}

/**
 * The worker's stance, from their card's preferences and the time they have already given: a time inside their hours
 * that nothing else holds, the materials they asked for, no more than their hours a day. Any number of coats: the
 * price follows them through the scope (`termDetails`). With a day to work on and their own hours, they propose the
 * first free start hour, or part of the day, when the household named none. `busy` is what other jobs and bookings
 * hold; a job lasts `jobHours`, else `DEFAULT_JOB_HOURS` from a start hour. With `now`, a time already over is never
 * free (ADR 0053 §2).
 */
export function workerStance(
  prefs: TermPrefs | undefined,
  busy: readonly Hours[],
  day?: string,
  now?: Date,
  jobHours?: number,
): Stance {
  const windows = prefs?.windows?.length ? prefs.windows : WINDOWS;
  // A day the worker does not work (ADR 0050 §2) is never free; work every day is judged by its hours alone.
  const workDay = (d: string) => !prefs?.days?.length || d === EVERY_DAY || prefs.days.includes(isoWeekday(d));
  const free = (w: TermWhen) =>
    workDay(w.day) &&
    inHours(prefs, windows, w) &&
    !busy.some((b) => overlaps(b, spanOf(w, jobHours))) &&
    !(now && whenPassed(w, now));
  const first = day ? firstFree(prefs, windows, day, free) : undefined;
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

/** A time inside the worker's hours: a start hour from `from` to before `to`, else a part of the day they work. */
function inHours(prefs: TermPrefs | undefined, windows: readonly TimeWindow[], w: TermWhen): boolean {
  const { from, to } = prefs ?? {};
  if (from === undefined || to === undefined) return windows.includes(w.window);
  if (w.hour !== undefined) return w.hour >= from && w.hour < to;
  return overlaps(spanOf(w), { day: w.day, start_min: from * MINUTES_PER_HOUR, end_min: to * MINUTES_PER_HOUR });
}

/** The worker's first free time on `day`: a start hour from their own hours, else a part of the day they chose. */
function firstFree(
  prefs: TermPrefs | undefined,
  windows: readonly TimeWindow[],
  day: string,
  free: (w: TermWhen) => boolean,
): TermWhen | undefined {
  const { from, to } = prefs ?? {};
  if (from !== undefined && to !== undefined)
    return range(from, to - 1)
      .map((h) => atHour(day, h))
      .find(free);
  return prefs?.windows?.length ? windows.map((window) => ({ day, window })).find(free) : undefined;
}

/**
 * The working hours a card shows (ADR 0050 §2), from the worker's preferences: the days and parts of the day they
 * take work, each every one when only the other is set; none when they set neither, which works any time.
 */
export function workHoursOf(prefs: TermPrefs | undefined): WorkHours | undefined {
  const { from, to } = prefs ?? {};
  const clock = from !== undefined && to !== undefined;
  if (!prefs?.days?.length && !prefs?.windows?.length && !clock) return undefined;
  // With hours on the clock, the parts of the day they touch go too, for older phones and servers (ADR 0053 §1).
  const windows = clock ? windowsOf(from * MINUTES_PER_HOUR, to * MINUTES_PER_HOUR) : prefs?.windows;
  return {
    days: prefs?.days?.length ? [...prefs.days] : [...ISO_WEEKDAYS],
    windows: windows?.length ? [...windows] : [...TimeWindow.options],
    ...(clock ? { from, to } : {}),
  };
}
