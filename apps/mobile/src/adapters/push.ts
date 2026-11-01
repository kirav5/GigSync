import { Capacitor } from "@capacitor/core";
import { log } from "@gigsync/core";
import { type Lang, PushSubscribe, type Session } from "@gigsync/protocol";
import { apiClient } from "./account.js";
import { isIos, standalone } from "./install.js";

/**
 * Notifications by Web Push (workers/api/src/push/webpush.ts, ADR 0043, 0044): with the owner's yes, this device
 * subscribes with the API's public key and gives the API its push address and keys. A push says, encrypted to this
 * device, what kind of message came and from whom; the service worker (sw/sw.js) names the sender from the names this
 * app gives it and words the notification in the owner's language.
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
const ASKED: NotificationPermission = "default";
/** The message the service worker keeps the owner's language from, for the alert's words. */
export const SW_LANG = "gigsync-lang";
/** The message that gives the service worker the names of the people this owner has jobs with, by user id. */
export const SW_NAMES = "gigsync-names";
/** Set once this phone offered notifications on its own, so it never asks again unprompted. */
const OFFERED_KEY = "gigsync-notifications-offered";

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
  if (!supported() || !offerSession || Notification.permission !== ASKED) return;
  if (!navigator.userActivation?.isActive) return;
  try {
    if (localStorage.getItem(OFFERED_KEY)) return;
    localStorage.setItem(OFFERED_KEY, "1");
  } catch {
    return;
  }
  try {
    await turnOnAlerts(offerSession);
  } catch (err) {
    log.warn("notifications not offered", { error: err instanceof Error ? err.name : typeof err });
  }
}

/** Turns alerts off here: the browser forgets the subscription, and the API the address. */
export async function turnOffAlerts(session: Session): Promise<AlertState> {
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
  if (!supported()) return;
  navigator.serviceWorker.controller?.postMessage({ type: SW_LANG, lang });
  try {
    const subscription = Notification.permission === GRANTED ? await current() : null;
    if (subscription) await apiClient(session).subscribePush(addressOf(subscription));
  } catch (err) {
    log.warn("alerts not refreshed", { error: err instanceof Error ? err.name : typeof err });
  }
}
