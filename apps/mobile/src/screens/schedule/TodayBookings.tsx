import { dueReminders, type Ports } from "@gigsync/core";
import type { Booking } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { useBookings } from "../../schedule/useBookings.js";
import { C } from "../../ui/cls.js";
import { BookingLines } from "./BookingLines.js";

/**
 * The worker's own bookings on Home, under today's jobs (ADR 0048 §4, §7): what is still to come, the one about to start marked, and
 * Delete on each. Nothing shows until there is a booking; they are added by saying them in Talk.
 */
export function TodayBookings({ ports }: { ports: Ports }) {
  const { t } = useI18n();
  const { bookings, now, remove } = useBookings(ports);
  if (!bookings || bookings.length === 0) return null;
  const soon = new Map(dueReminders(bookings, now).map((r) => [r.booking.id, r.in_min]));
  const extra = (b: Booking) => {
    const minutes = soon.get(b.id);
    return minutes === undefined ? undefined : t("schedule.soon", { minutes });
  };
  return (
    <section className={C.card} aria-label={t("schedule.title")}>
      <span className={C.label}>{t("schedule.title")}</span>
      <BookingLines bookings={bookings} today={now.day} onDelete={(id) => void remove(id)} extra={extra} />
      <span className={C.faint}>{t("schedule.hint")}</span>
    </section>
  );
}
