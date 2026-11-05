import {
  type Booking,
  DEFAULT_JOB_HOURS,
  EVERY_DAY,
  MINUTES_PER_DAY,
  type TermWhen,
  TimeWindow,
} from "@gigsync/protocol";

/**
 * Where the `when` term's parts of the day begin, on a 24-hour clock: what a household's "3 pm" means (`windowOf`) and
 * what a worker's booking covers (ADR 0048 §5) are read against the same hours.
 */
export const AFTERNOON_FROM = 12;
export const EVENING_FROM = 16;
export const MINUTES_PER_HOUR = 60;
/** The first and last hour a job may start at, on the 24-hour clock: the hours a household picks from. */
export const FIRST_HOUR = 7;
export const LAST_HOUR = 20;

const MS_PER_MINUTE = 60_000;
/** Length of "YYYY-MM-DD" at the start of an ISO timestamp. */
const ISO_DAY_LENGTH = 10;

/** Each window's minutes after midnight, end excluded. */
const WINDOW_MINUTES: Readonly<Record<TimeWindow, readonly [number, number]>> = {
  [TimeWindow.enum.morning]: [0, AFTERNOON_FROM * MINUTES_PER_HOUR],
  [TimeWindow.enum.afternoon]: [AFTERNOON_FROM * MINUTES_PER_HOUR, EVENING_FROM * MINUTES_PER_HOUR],
  [TimeWindow.enum.evening]: [EVENING_FROM * MINUTES_PER_HOUR, MINUTES_PER_DAY],
};

/** The day and minute on the phone's own clock. */
export interface LocalNow {
  /** "YYYY-MM-DD". */
  day: string;
  minute: number;
}

/** `now` on a phone `offsetMinutes` ahead of UTC (India: 330). */
export function localNow(now: Date, offsetMinutes: number): LocalNow {
  const local = new Date(now.getTime() + offsetMinutes * MS_PER_MINUTE);
  return {
    day: local.toISOString().slice(0, ISO_DAY_LENGTH),
    minute: local.getUTCHours() * MINUTES_PER_HOUR + local.getUTCMinutes(),
  };
}

/** The windows a stretch of minutes touches: 11:30 to 12:30 is in the morning and the afternoon. */
export function windowsOf(start: number, end: number): TimeWindow[] {
  return TimeWindow.options.filter((w) => start < WINDOW_MINUTES[w][1] && end > WINDOW_MINUTES[w][0]);
}

/** The part of the day an hour on the clock falls in. */
export const windowAt = (hour: number): TimeWindow =>
  hour < AFTERNOON_FROM
    ? TimeWindow.enum.morning
    : hour < EVENING_FROM
      ? TimeWindow.enum.afternoon
      : TimeWindow.enum.evening;

/** A time with a start hour, its part of the day set to match (ADR 0053 §1). */
export const atHour = (day: string, hour: number): TermWhen => ({ day, window: windowAt(hour), hour });

/** What a booking's place in the week comes down to. */
export type Hours = Pick<Booking, "day" | "start_min" | "end_min">;

/**
 * The minutes of its day a time takes (ADR 0053 §1): from its start hour, `hours` long (`DEFAULT_JOB_HOURS` when the
 * job says none), up to midnight; without a start hour, its whole part of the day.
 */
export function spanOf(w: TermWhen, hours?: number): Hours {
  if (w.hour === undefined)
    return { day: w.day, start_min: WINDOW_MINUTES[w.window][0], end_min: WINDOW_MINUTES[w.window][1] };
  const start_min = w.hour * MINUTES_PER_HOUR;
  const end_min = Math.min(MINUTES_PER_DAY, start_min + (hours ?? DEFAULT_JOB_HOURS) * MINUTES_PER_HOUR);
  return { day: w.day, start_min, end_min };
}

/** Two stretches of a day share some minutes, on a day both fall on (work every day falls on every day). */
export const overlaps = (a: Hours, b: Hours): boolean =>
  (a.day === b.day || a.day === EVERY_DAY || b.day === EVERY_DAY) && a.start_min < b.end_min && b.start_min < a.end_min;

/** The phone's own offset from UTC in minutes, from its clock: what `localNow` needs on the phone itself. */
export const phoneOffset = (now: Date): number => -now.getTimezoneOffset();

/**
 * A time that is over (ADR 0053 §2): a day before today; today, a start hour once it has come, or a part of the day once
 * it has ended. Work every day is never over. Read on the phone's own clock.
 */
export function whenPassed(w: TermWhen, now: Date): boolean {
  if (w.day === EVERY_DAY) return false;
  const local = localNow(now, phoneOffset(now));
  if (w.day !== local.day) return w.day < local.day;
  if (w.hour !== undefined) return local.minute >= w.hour * MINUTES_PER_HOUR;
  return local.minute >= WINDOW_MINUTES[w.window][1];
}
