import { Capacitor } from "@capacitor/core";
import { log } from "@gigsync/core";
import type { Lang, Session } from "@gigsync/protocol";
import { apiClient } from "./account.js";
import { isIos, standalone } from "./install.js";

/**
 * Job alerts by Web Push (workers/api/src/push/webpush.ts): with the owner's yes, this device subscribes with the API's
 * public key and tells the API where its browser takes pushes. The pushes are empty; the service worker (sw/sw.js)
 * shows a plain "your job has an update" in the owner's language and the app opens its own messages.
 */

/** Where alerts stand on this device, as Settings says it. */
export const AlertState = {
  on: "on",
  off: "off",
  /** The owner said no in the browser's own prompt; only the browser's site settings can undo it. */
  blocked: "blocked",
  /** An iPhone takes pushes only in the app added to the Home Screen. */
  install: "install",
  /** This browser has no Web Push, or this is a development build (no service worker). */
  unsupported: "unsupported",
  /** The API has no push key yet, so there is nothing to subscribe to. */
  unavailable: "unavailable",
} as const;
export type AlertState = (typeof AlertState)[keyof typeof AlertState];

const GRANTED: NotificationPermission = "granted";
const DENIED: NotificationPermission = "denied";
/** The message the service worker keeps the owner's language from, for the alert's words. */
export const SW_LANG = "gigsync-lang";

const supported = () =>
  !Capacitor.isNativePlatform() &&
  "serviceWorker" in navigator &&
  "PushManager" in globalThis &&
  "Notification" in globalThis;

/** The base64url key as the bytes `subscribe` wants. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (key.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** This device's current subscription, if the service worker is up and has one. */
async function current(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Where alerts stand now, without asking the owner anything. */
export async function alertState(): Promise<AlertState> {
  if (isIos() && !standalone()) return AlertState.install;
  if (!supported() || !(await navigator.serviceWorker.getRegistration())) return AlertState.unsupported;
  if (Notification.permission === DENIED) return AlertState.blocked;
  return Notification.permission === GRANTED && (await current()) ? AlertState.on : AlertState.off;
}

/** Turns alerts on: the browser asks the owner (call only from their tap), then this device subscribes. */
export async function turnOnAlerts(session: Session): Promise<AlertState> {
  const state = await alertState();
  if (state !== AlertState.off) return state;
  if ((await Notification.requestPermission()) !== GRANTED) return AlertState.blocked;
  const api = apiClient(session);
  const key = await api.pushKey();
  if (!key) return AlertState.unavailable;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(key),
  });
  await api.subscribePush(subscription.endpoint);
  return AlertState.on;
}

/** Turns alerts off here: the browser forgets the subscription, and the API the address. */
export async function turnOffAlerts(session: Session): Promise<AlertState> {
  await (await current())?.unsubscribe();
  await apiClient(session).unsubscribePush();
  return AlertState.off;
}

/**
 * On each open with alerts on: tells the API this device's address again (a push service may have changed it, and an
 * address it called gone was dropped), and tells the service worker the owner's language for the alert's words.
 */
export async function refreshAlerts(session: Session, lang: Lang): Promise<void> {
  if (!supported()) return;
  navigator.serviceWorker.controller?.postMessage({ type: SW_LANG, lang });
  try {
    const subscription = Notification.permission === GRANTED ? await current() : null;
    if (subscription) await apiClient(session).subscribePush(subscription.endpoint);
  } catch (err) {
    log.warn("alerts not refreshed", { error: err instanceof Error ? err.name : typeof err });
  }
}
