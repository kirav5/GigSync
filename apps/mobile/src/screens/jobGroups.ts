import { localDay } from "@gigsync/core";

/** A date-only ISO string read as midday on this phone, so no time zone or clock change moves it to another day. */
const LOCAL_NOON = "T12:00:00";

/** Today's date on this phone ("YYYY-MM-DD"), in the phone's own time zone. */
export function phoneDay(now: Date): string {
  return localDay(now, -now.getTimezoneOffset());
}

/** A job's day ("YYYY-MM-DD") as a date to show with the owner's `date()`. */
export function dayDate(day: string): Date {
  return new Date(day + LOCAL_NOON);
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `day` (both "YYYY-MM-DD"): 1 is tomorrow, -1 yesterday; rounded over a clock change. */
export function daysFrom(from: string, day: string): number {
  return Math.round((dayDate(day).getTime() - dayDate(from).getTime()) / DAY_MS);
}
