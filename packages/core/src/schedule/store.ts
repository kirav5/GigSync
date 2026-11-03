import { Booking, BookingId, EVERY_DAY } from "@gigsync/protocol";
import { ulid } from "ulid";
import { log } from "../log.js";
import { Collection, type Storage } from "../ports.js";
import type { LocalNow } from "./windows.js";

/**
 * A worker's bookings on this phone (ADR 0048 §1): parsed with the protocol's schema on every read, since a moved
 * package or an older app may have written them, and kept in day and time order. Past bookings are dropped as new ones
 * are saved, so the collection never grows without end.
 */

const BOOKING_PREFIX = "bkg_";

/** The new booking as said: everything but its id and when it was saved. */
export type NewBooking = Omit<Booking, "id" | "created_at">;

/** In day and time order; daily work first on any day, since it happens every day. */
const byTime = (a: Booking, b: Booking): number =>
  (a.day === EVERY_DAY ? "" : a.day).localeCompare(b.day === EVERY_DAY ? "" : b.day) || a.start_min - b.start_min;

/** Every booking this owner kept, in order; a record that does not parse is skipped and logged, never shown. */
export async function listBookings(storage: Storage): Promise<Booking[]> {
  const found = await storage.list<unknown>(Collection.bookings);
  const parsed = found.map((value) => Booking.safeParse(value));
  const bad = parsed.filter((p) => !p.success).length;
  if (bad > 0) log.warn("bookings: unreadable records skipped", { count: bad });
  return parsed.flatMap((p) => (p.success ? [p.data] : [])).sort(byTime);
}

/** The booking falls on `day`: that day, or every day. */
export const isOn = (b: Booking, day: string): boolean => b.day === day || b.day === EVERY_DAY;

/** Bookings still to come or under way: from now on today, any later day, and daily work. */
export const upcoming = (bookings: readonly Booking[], now: LocalNow): Booking[] =>
  bookings.filter((b) => b.day === EVERY_DAY || b.day > now.day || (b.day === now.day && b.end_min > now.minute));

/** Keeps a new booking, and drops the ones whose day has passed. */
export async function saveBooking(storage: Storage, booking: NewBooking, at: Date, now: LocalNow): Promise<Booking> {
  const saved = Booking.parse({
    ...booking,
    id: `${BOOKING_PREFIX}${ulid(at.getTime())}`,
    created_at: at.toISOString(),
  });
  const past = (await listBookings(storage)).filter((b) => b.day !== EVERY_DAY && b.day < now.day);
  await Promise.all([
    storage.put(Collection.bookings, saved.id, saved),
    ...past.map((b) => storage.delete(Collection.bookings, b.id)),
  ]);
  return saved;
}

/** Takes one booking off; an id that is not a booking id changes nothing. */
export async function removeBooking(storage: Storage, id: string): Promise<void> {
  if (BookingId.safeParse(id).success) await storage.delete(Collection.bookings, id);
}
