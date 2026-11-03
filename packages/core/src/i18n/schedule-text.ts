import { type Booking, EVERY_DAY, type Lang } from "@gigsync/protocol";
import { addDays } from "../interview/need-parse.js";
import { LOCALE, t } from "./t.js";

/**
 * A worker's bookings as they read them (ADR 0048), in their language: the day as today, tomorrow, every day or a
 * date in the phone's locale, and the hours in its clock. ISO days and minutes after midnight are calendar values, so
 * both are formatted in UTC and no time zone moves them.
 */

const MS_PER_MINUTE = 60_000;
const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: "UTC" };

/** "2:00 pm" for 840 minutes after midnight, in the owner's locale. */
export const minuteText = (lang: Lang, minute: number): string =>
  new Date(minute * MS_PER_MINUTE).toLocaleTimeString(LOCALE[lang], TIME_FORMAT);

/** "Today", "Tomorrow", "Every day" or "Wed, 5 Nov", seen from `today` ("YYYY-MM-DD"). */
export function bookingDayText(lang: Lang, day: string, today: string): string {
  if (day === EVERY_DAY) return t(lang, "when.daily");
  if (day === today) return t(lang, "schedule.today");
  if (day === addDays(today, 1)) return t(lang, "schedule.tomorrow");
  return new Date(day).toLocaleDateString(LOCALE[lang], DAY_FORMAT);
}

/** "Tomorrow, 2:00 pm – 3:00 pm". */
export const bookingText = (lang: Lang, b: Pick<Booking, "day" | "start_min" | "end_min">, today: string): string =>
  t(lang, "schedule.when", {
    day: bookingDayText(lang, b.day, today),
    start: minuteText(lang, b.start_min),
    end: minuteText(lang, b.end_min),
  });
