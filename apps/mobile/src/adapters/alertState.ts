/** Where alerts stand on this device, as Settings says it: Web Push in a browser (push.ts), FCM in the app (nativePush.ts). */
export const AlertState = {
  on: "on",
  off: "off",
  /** The owner said no in the browser's or the phone's own prompt; only its settings can undo it. */
  blocked: "blocked",
  /** An iPhone takes pushes only in the app added to the Home Screen. */
  install: "install",
  /** This browser has no Web Push, or this is a development build (no service worker). */
  unsupported: "unsupported",
  /** The API cannot send alerts here yet (no push key, no Firebase account), so there is nothing to turn on. */
  unavailable: "unavailable",
} as const;
export type AlertState = (typeof AlertState)[keyof typeof AlertState];

/** Set once this phone offered notifications on its own, so it never asks again unprompted. */
export const OFFERED_KEY = "gigsync-notifications-offered";

/** Whether this phone already offered notifications on its own; marks it offered. False when storage is shut. */
export function firstOffer(): boolean {
  try {
    if (localStorage.getItem(OFFERED_KEY)) return false;
    localStorage.setItem(OFFERED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
