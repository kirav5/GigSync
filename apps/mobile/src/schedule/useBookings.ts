import { type LocalNow, listBookings, localNow, log, type Ports, removeBooking, upcoming } from "@gigsync/core";
import type { Booking } from "@gigsync/protocol";
import { useCallback, useEffect, useState } from "react";

/** How often the bookings on screen are read again and "starts in" counts down. */
export const SCHEDULE_TICK_MS = 60_000;

/** The phone's own day and minute at `at`, in its time zone. */
export const localAt = (at: Date): LocalNow => localNow(at, -at.getTimezoneOffset());

/** The phone's own day and minute now. */
export const phoneNow = (ports: Ports): LocalNow => localAt(ports.clock.now());

/**
 * The worker's bookings still to come (ADR 0048), read from this phone and again every minute, so one saved in Talk
 * shows on Today and one that ended drops off. `remove` deletes one and reads them again.
 */
export function useBookings(ports: Ports): {
  bookings: readonly Booking[] | undefined;
  now: LocalNow;
  remove: (id: string) => Promise<void>;
} {
  const [bookings, setBookings] = useState<Booking[]>();
  const [now, setNow] = useState(() => phoneNow(ports));
  const reload = useCallback(async () => {
    try {
      const at = phoneNow(ports);
      setNow(at);
      setBookings(upcoming(await listBookings(ports.storage), at));
    } catch (err) {
      log.warn("reading bookings failed", { error: err instanceof Error ? err.name : typeof err });
      setBookings([]);
    }
  }, [ports]);
  useEffect(() => {
    void reload();
    const tick = setInterval(() => void reload(), SCHEDULE_TICK_MS);
    return () => clearInterval(tick);
  }, [reload]);
  const remove = useCallback(
    async (id: string) => {
      await removeBooking(ports.storage, id);
      await reload();
    },
    [ports, reload],
  );
  return { bookings, now, remove };
}
