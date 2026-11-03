import { z } from "zod";
import { TermWhen, TimeWindow } from "./terms.js";

/**
 * When a worker works, as a shop shows its hours (ADR 0050 §2): the weekdays and the parts of the day. It is on the
 * public card so the board can leave out workers who do not work at the time a household asks for. It says nothing
 * of the worker's bookings or jobs, which stay on their phone (ADR 0048); a worker who is busy then still says so
 * when asked. A card without it works any day, any time, as every card did before.
 */

/** ISO weekday: 1 Monday … 7 Sunday. */
export const IsoWeekday = z.number().int().min(1).max(7);
export type IsoWeekday = z.infer<typeof IsoWeekday>;
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const MAX_WINDOWS = TimeWindow.options.length;

const distinct = (values: readonly unknown[]) => new Set(values).size === values.length;

export const WorkHours = z.object({
  days: z.array(IsoWeekday).min(1).max(ISO_WEEKDAYS.length).refine(distinct, "no repeated days"),
  windows: z.array(TimeWindow).min(1).max(MAX_WINDOWS).refine(distinct, "no repeated windows"),
});
export type WorkHours = z.infer<typeof WorkHours>;

/** The ISO weekday of a "YYYY-MM-DD" day, as the calendar has it anywhere. */
export function isoWeekday(day: string): IsoWeekday {
  const sunday0 = new Date(`${day}T00:00:00Z`).getUTCDay();
  return sunday0 === 0 ? 7 : sunday0;
}

/** A household's day for a search: a date, or every day; the same values as `when.day`. */
export const SearchDay = TermWhen.shape.day;
export type SearchDay = z.infer<typeof SearchDay>;
