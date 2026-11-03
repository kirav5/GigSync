import { z } from "zod";
import { prefixedId } from "./ids.js";
import { EVERY_DAY } from "./terms.js";

/**
 * A worker's own bookings (ADR 0048): work they agreed outside GigSync, kept on their phone only and moved to a new
 * phone with everything else. Times are minutes after the phone's local midnight, so a booking means the same hour
 * wherever the phone's clock is read; a booking ends on the day it starts.
 */

export const BookingId = prefixedId("bkg");
export type BookingId = z.infer<typeof BookingId>;

export const MINUTES_PER_DAY = 1440;
/** What a booking keeps of the owner's words about where or for whom. */
export const BOOKING_NOTE_MAX = 120;
const Minute = z.number().int().min(0).max(MINUTES_PER_DAY);

export const Booking = z
  .object({
    id: BookingId,
    /** "YYYY-MM-DD", or `EVERY_DAY` for work done every day. */
    day: z.union([z.iso.date(), z.literal(EVERY_DAY)]),
    start_min: Minute,
    end_min: Minute,
    note: z.string().trim().min(1).max(BOOKING_NOTE_MAX).optional(),
    /** ISO time it was saved. */
    created_at: z.iso.datetime(),
  })
  .refine((b) => b.end_min > b.start_min, { message: "ends after it starts", path: ["end_min"] });
export type Booking = z.infer<typeof Booking>;
