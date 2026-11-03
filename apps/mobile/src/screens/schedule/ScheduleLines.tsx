import type { Card, CardKind } from "@gigsync/core";
import { localAt } from "../../schedule/useBookings.js";
import { BookingLines } from "./BookingLines.js";

/**
 * The bookings and jobs under the agent's schedule reply in Talk, written in the owner's language as it is now. "Today"
 * is the phone's day when the chat is read; Delete lives on Today, where the list is current.
 */
export function ScheduleLines({ card }: { card: Extract<Card, { kind: typeof CardKind.schedule }> }) {
  if (card.bookings.length + card.jobs.length === 0) return null;
  return <BookingLines bookings={card.bookings} jobs={card.jobs} today={localAt(new Date()).day} />;
}
