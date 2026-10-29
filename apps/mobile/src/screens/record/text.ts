import { type JobRecord, LOCALE } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";

/** How a record row reads: its month heading, its day, the other side's name, and the look of its chip. */

/** A "YYYY-MM" month read as the middle of that month on this phone, so no time zone moves it to another month. */
const MID_MONTH = "-15T12:00:00";
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
const WEEKDAY_DAY: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric" };

/** The tag looks from styles.css a chip can take. */
export const Tag = { fresh: "tag fresh", wait: "tag wait", talk: "tag talk", plain: "tag" } as const;
export type Tag = (typeof Tag)[keyof typeof Tag];

/** A row's chip: its words, and its look. */
export interface Chip {
  text: string;
  cls: Tag;
}

/**
 * "October 2026" in the owner's language ("अक्टूबर 2026", "ಅಕ್ಟೋಬರ್ 2026"), for a month heading ("YYYY-MM") or the
 * month of a day. Beside `date()` and `time()` from i18n.tsx, in the same locales.
 */
export function monthText(lang: Lang, month: string | Date): string {
  const at = typeof month === "string" ? new Date(month + MID_MONTH) : month;
  return at.toLocaleDateString(LOCALE[lang], MONTH_YEAR);
}

/** "Wed 28": a day under its month's heading, in the owner's language. */
export const weekdayText = (lang: Lang, at: Date): string => at.toLocaleDateString(LOCALE[lang], WEEKDAY_DAY);

/** The other side's name as Passbook shows it: from their contact card, else the board, else `fallback`. */
export const whoOf = (job: JobRecord, names: Readonly<Record<string, string>>, fallback: string): string =>
  job.contact?.name || names[job.engagement.counterpart] || fallback;
