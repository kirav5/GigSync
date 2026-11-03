import { dueReminders, listBookings, log, minuteText, type Ports, t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useEffect } from "react";
import { remindOnPhone } from "../adapters/remind.js";
import { phoneNow, SCHEDULE_TICK_MS } from "./useBookings.js";

/** Reminders already given while the app ran, by booking and day. */
const given = new Set<string>();

/** Notifies each booking about to start, once (ADR 0048 §7); a no-op unless the owner allowed notifications. */
async function remindDue(ports: Ports, lang: Lang): Promise<void> {
  const due = dueReminders(await listBookings(ports.storage), phoneNow(ports)).filter((r) => !given.has(r.key));
  for (const { key, booking, in_min } of due) {
    given.add(key);
    const title = t(lang, "schedule.remind_title", { time: minuteText(lang, booking.start_min) });
    const starts = t(lang, "schedule.remind_body", { minutes: in_min });
    await remindOnPhone(key, title, booking.note ? `${booking.note}. ${starts}` : starts);
  }
}

/** While a worker's app runs, checks every minute for a booking about to start. */
export function useReminders(ports: Ports, lang: Lang, on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const check = () =>
      remindDue(ports, lang).catch((err: unknown) =>
        log.warn("reminders not checked", { error: err instanceof Error ? err.name : typeof err }),
      );
    void check();
    const tick = setInterval(check, SCHEDULE_TICK_MS);
    return () => clearInterval(tick);
  }, [ports, lang, on]);
}
