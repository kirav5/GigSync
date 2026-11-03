import { bookingText, whenText } from "@gigsync/core";
import type { Booking, TermWhen } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./schedule.css";

interface Props {
  bookings: readonly Booking[];
  /** Signed GigSync jobs, as the day and part of the day each agreed. */
  jobs?: readonly TermWhen[];
  /** The phone's day, "YYYY-MM-DD": what "Today" and "Tomorrow" are. */
  today: string;
  /** Shows Delete on each booking; jobs are never deleted here. */
  onDelete?: (id: string) => void;
  /** A line under a booking, such as "Starts in 20 min". */
  extra?: (b: Booking) => string | undefined;
}

/** Bookings and signed jobs, one line each, written in the owner's language now (ADR 0048 §4). */
export function BookingLines({ bookings, jobs = [], today, onDelete, extra }: Props) {
  const { lang, t } = useI18n();
  return (
    <ul className="booking-lines">
      {bookings.map((b) => {
        const when = bookingText(lang, b, today);
        const more = extra?.(b);
        return (
          <li key={b.id}>
            <div className={C.stack}>
              <strong>{when}</strong>
              {b.note && <span className={C.muted}>{b.note}</span>}
              {more && <span className={C.faint}>{more}</span>}
            </div>
            {onDelete && (
              <button
                type={C.button}
                className={C.quiet}
                aria-label={t("schedule.delete_named", { when })}
                onClick={() => onDelete(b.id)}
              >
                {t("schedule.delete")}
              </button>
            )}
          </li>
        );
      })}
      {jobs.map((j) => (
        <li key={`${j.day}-${j.window}`}>
          <span>{t("schedule.job", { when: whenText(lang, j) })}</span>
        </li>
      ))}
    </ul>
  );
}
