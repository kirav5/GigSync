import { SHARED_PRICE_MONTHS } from "./constants.js";

/** Calendar months for shared prices, in UTC: a shared price names a month ("2026-10"), never a day. */

const MONTHS_PER_YEAR = 12;
const ISO_DAY_LENGTH = 10;
const FIRST_DAY = "-01";
const SEPARATOR = "-";

const monthIndex = (year: number, month: number) => year * MONTHS_PER_YEAR + (month - 1);
const nowIndex = (now: Date) => monthIndex(now.getUTCFullYear(), now.getUTCMonth() + 1);

function parseMonth(month: string): number {
  const [year, mm] = month.split(SEPARATOR).map(Number);
  return monthIndex(year ?? 0, mm ?? 0);
}

function formatMonth(index: number): string {
  const year = Math.floor(index / MONTHS_PER_YEAR);
  const month = (index % MONTHS_PER_YEAR) + 1;
  return `${year}${SEPARATOR}${String(month).padStart(2, "0")}`;
}

/** "2026-10" → "2026-10-01", the value a DATE column holds for the month. */
export const monthStart = (month: string): string => `${month}${FIRST_DAY}`;

/** Today in UTC, "2026-10-29". */
export const utcDay = (now: Date): string => now.toISOString().slice(0, ISO_DAY_LENGTH);

/** A shared price's month must be this month or one of the previous `SHARED_PRICE_MONTHS - 1`: not future, not old. */
export function isShareableMonth(month: string, now: Date): boolean {
  const ago = nowIndex(now) - parseMonth(month);
  return ago >= 0 && ago < SHARED_PRICE_MONTHS;
}

/** The first day of the oldest month whose shared prices still count for an estimate. */
export const firstMonthCounted = (now: Date): string =>
  monthStart(formatMonth(nowIndex(now) - (SHARED_PRICE_MONTHS - 1)));
