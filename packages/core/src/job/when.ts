import { EVERY_DAY, type JobRequest, Trade } from "@gigsync/protocol";

/**
 * The job's day as a structured detail, so each phone can file it under Today or Coming up without reading translated
 * text. The consumer's When chips write `details.day` (an ISO date, or `EVERY_DAY`) and `details.time` (free text, for
 * people only). Details already travel in the request and into the signed scope, so neither needs a protocol change.
 */
export const WhenDetail = { day: "day", time: "time" } as const;
export type WhenDetail = (typeof WhenDetail)[keyof typeof WhenDetail];

/** `details.day` for work wanted every day: the same value a `when` term uses for it. */
export { EVERY_DAY };

/** Trades paid by the month: the work recurs, so it counts as every day. */
export const MONTHLY_TRADES: ReadonlySet<Trade> = new Set([Trade.enum.cook, Trade.enum.maid]);

export const isMonthly = (trade: Trade): boolean => MONTHLY_TRADES.has(trade);

/** The part of a request (or a consumer's need) that says when the work is. */
type Dated = Pick<JobRequest, "trade" | "details">;

const MS_PER_MINUTE = 60_000;
/** Length of "YYYY-MM-DD" at the start of an ISO timestamp. */
const ISO_DAY_LENGTH = 10;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day at `now` on a phone `offsetMinutes` ahead of UTC (India: 330), as "YYYY-MM-DD". */
export function localDay(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() + offsetMinutes * MS_PER_MINUTE).toISOString().slice(0, ISO_DAY_LENGTH);
}

/**
 * The request's day: an ISO date or `EVERY_DAY`. Undefined for requests from before the When chips, and for anything
 * else the other phone put there: the value is the sender's free text until checked.
 */
export function dayOf(request: Dated): string | undefined {
  const day = request.details[WhenDetail.day];
  return day === EVERY_DAY || (day !== undefined && ISO_DAY.test(day)) ? day : undefined;
}

/**
 * The work happens on `day` ("YYYY-MM-DD"): it was asked for that day or every day, or it is monthly work that has
 * started by then (or never said when it starts). ISO days compare correctly as strings.
 */
export function isOnDay(request: Dated, day: string): boolean {
  const asked = dayOf(request);
  if (asked === EVERY_DAY || asked === day) return true;
  return isMonthly(request.trade) && (asked === undefined || asked < day);
}

/** The work is on a single day after `day`, or monthly work that starts after it. */
export function isAfterDay(request: Dated, day: string): boolean {
  const asked = dayOf(request);
  return asked !== undefined && asked !== EVERY_DAY && asked > day;
}
