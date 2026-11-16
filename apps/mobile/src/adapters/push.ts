import { Capacitor } from "@capacitor/core";
import { log } from "@gigsync/core";
import { type Lang, PushSubscribe, type Session } from "@gigsync/protocol";
import { apiClient } from "./account.js";
import { AlertState, firstOffer } from "./alertState.js";
import { isIos, standalone } from "./install.js";
import { isAndroidApp, nativeAlertState, refreshNative, turnOffNative, turnOnNative } from "./nativePush.js";

export { AlertState } from "./alertState.js";

/**
 * Notifications by Web Push (workers/api/src/push/webpush.ts, ADR 0043, 0044): with the owner's yes, this device
 * subscribes with the API's public key and gives the API its push address and keys. A push says, encrypted to this
 * device, what kind of message came and from whom; the service worker (sw/sw.js) names the sender from the names this
 * app gives it and words the notification in the owner's language. The installed Android app takes its alerts by
 * FCM instead (nativePush.ts, ADR 0067); each function here hands over to it there.
 */

const GRANTED: NotificationPermission = "granted";
const DENIED: NotificationPermission = "denied";
const ASKED: NotificationPermission = "default";
/** The message the service worker keeps the owner's language from, for the alert's words. */
export const SW_LANG = "gigsync-lang";
/** The message that gives the service worker the names of the people this owner has jobs with, by user id. */
export const SW_NAMES = "gigsync-names";

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
  if (isAndroidApp()) return nativeAlertState(offerSession);
  if (isIos() && !standalone()) return AlertState.install;
  if (!supported() || !(await navigator.serviceWorker.getRegistration())) return AlertState.unsupported;
  if (Notification.permission === DENIED) return AlertState.blocked;
  return Notification.permission === GRANTED && (await current()) ? AlertState.on : AlertState.off;
}

/** Turns alerts on: the browser asks the owner (call only from their tap), then this device subscribes. */
export async function turnOnAlerts(session: Session): Promise<AlertState> {
  if (isAndroidApp()) return turnOnNative(session);
  const state = await alertState();
  if (state !== AlertState.off) return state;
  if ((await Notification.requestPermission()) !== GRANTED) return AlertState.blocked;
  const api = apiClient(session);
  const key = (await api.pushKey()).public_key;
  if (!key) return AlertState.unavailable;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(key),
  });
  await api.subscribePush(addressOf(subscription));
  return AlertState.on;
}

/** The subscription as the API keeps it: the address and the keys to encrypt to. */
function addressOf(subscription: PushSubscription): PushSubscribe {
  return PushSubscribe.parse(subscription.toJSON());
}

/** The signed-in owner's session, for an offer made from a tap anywhere in the app (set by useAlerts). */
let offerSession: Session | undefined;
export const setOfferSession = (session: Session | undefined) => {
  offerSession = session;
};

/**
 * Notifications are on unless the owner says no: the browser lets a page ask only from a tap, so the first time the
 * owner does something that starts a job's news (asks workers, publishes a card, signs, sends an update) the browser
 * asks once. Never again on its own after that, whatever the answer; Settings can still turn them on.
 */
export async function offerAlerts(): Promise<void> {
  if (isAndroidApp()) {
    if (offerSession && firstOffer()) await turnOnNative(offerSession).catch(() => undefined);
    return;
  }
  if (!supported() || !offerSession || Notification.permission !== ASKED) return;
  if (!navigator.userActivation?.isActive) return;
  if (!firstOffer()) return;
  try {
    await turnOnAlerts(offerSession);
  } catch (err) {
    log.warn("notifications not offered", { error: err instanceof Error ? err.name : typeof err });
  }
}

/** Turns alerts off here: the browser forgets the subscription, and the API the address. */
export async function turnOffAlerts(session: Session): Promise<AlertState> {
  if (isAndroidApp()) return turnOffNative(session);
  await (await current())?.unsubscribe();
  await apiClient(session).unsubscribePush();
  return AlertState.off;
}

/** Tells the service worker who the people this owner has jobs with are, so a notification can name its sender. */
export function tellNames(names: Readonly<Record<string, string>>): void {
  if (supported()) navigator.serviceWorker.controller?.postMessage({ type: SW_NAMES, names });
}

/**
 * On each open with notifications on: tells the API this device's address and keys again (a push service may have
 * changed them, and an address it called gone was dropped), and the service worker the owner's language.
 */
export async function refreshAlerts(session: Session, lang: Lang): Promise<void> {
  if (isAndroidApp()) return refreshNative(session, lang);
  if (!supported()) return;
  navigator.serviceWorker.controller?.postMessage({ type: SW_LANG, lang });
  try {
    const subscription = Notification.permission === GRANTED ? await current() : null;
    if (subscription) await apiClient(session).subscribePush(addressOf(subscription));
  } catch (err) {
    log.warn("alerts not refreshed", { error: err instanceof Error ? err.name : typeof err });
  }
}
