import { log } from "@gigsync/core";

/**
 * A reminder the phone gives itself (ADR 0048 §7): a notification from the service worker when the owner allowed
 * notifications, else nothing (Today still shows it). Shown while the app runs; nothing is sent anywhere to time it.
 */

const GRANTED: NotificationPermission = "granted";
/** One reminder per booking and day: a second call for the same key replaces the first instead of adding one. */
const TAG_PREFIX = "booking-";
/** The same icon the service worker's job notifications use. */
const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

export async function remindOnPhone(key: string, title: string, body: string): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== GRANTED) return;
  const options: NotificationOptions = { body, tag: `${TAG_PREFIX}${key}`, icon: ICON };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch (err) {
    log.warn("reminder not shown", { error: err instanceof Error ? err.name : typeof err });
  }
}
