import type { Booking } from "@gigsync/protocol";
import { isOn } from "./store.js";
import type { LocalNow } from "./windows.js";

/**
 * Reminders the phone gives itself (ADR 0048 §7): a booking about to start, while the app runs. Nothing about the
 * schedule goes to a server to time them.
 */

/** How long before a booking starts it is shown on Today and, with the owner's yes, as a notification. */
export const REMINDER_LEAD_MINUTES = 30;

export interface Reminder {
  booking: Booking;
  /** One per booking and day, so daily work is reminded each day and once. */
  key: string;
  /** Minutes until it starts. */
  in_min: number;
}

/** The bookings starting within `lead` minutes of now, soonest first. */
export function dueReminders(bookings: readonly Booking[], now: LocalNow, lead = REMINDER_LEAD_MINUTES): Reminder[] {
  return bookings
    .filter((b) => isOn(b, now.day) && b.start_min > now.minute && b.start_min - lead <= now.minute)
    .sort((a, b) => a.start_min - b.start_min)
    .map((booking) => ({ booking, key: `${booking.id}:${now.day}`, in_min: booking.start_min - now.minute }));
}
