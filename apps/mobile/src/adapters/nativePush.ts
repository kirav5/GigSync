import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { log, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang, type Session } from "@gigsync/protocol";
import { apiClient } from "./account.js";
import { AlertState } from "./alertState.js";

/**
 * The Android app's alerts by Firebase Cloud Messaging (ADR 0067): with the owner's yes, the app registers with FCM and
 * gives the API its token and language; the API sends a plain "something new" that Android shows itself, app running
 * or not. An alert that comes while the app is open, or a tap on one, syncs at once. A build without Firebase's
 * `google-services.json` cannot register: the plugin's call fails, and Settings says alerts are not available.
 */

const ANDROID = "android";
const GRANTED = "granted";
const DENIED = "denied";
/** The channel the API's alerts are sent on (workers/api/src/push/fcm.ts, FCM_CHANNEL). */
const CHANNEL = "job-alerts";
/** Android's high importance: the alert sounds and shows at the top of the screen. */
const IMPORTANCE_HIGH = 4;
/** Set while the owner has alerts on in the app, so Settings can say so. */
const ON_KEY = "gigsync-native-alerts";

/** The installed Android app, where alerts come by FCM instead of Web Push. iPhone apps are not covered yet. */
export const isAndroidApp = (): boolean => Capacitor.getPlatform() === ANDROID;

/** Who is signed in and in what language their alerts are worded, for the token FCM gives (it can come any time). */
let owner: { session: Session; lang: Lang } | undefined;
let listening = false;
const arrivals = new Set<() => void>();

function rememberOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(ON_KEY, "1");
    else localStorage.removeItem(ON_KEY);
  } catch {
    // Storage shut: Settings shows Off, and turning it on again registers again.
  }
}

function isOn(): boolean {
  try {
    return localStorage.getItem(ON_KEY) !== null;
  } catch {
    return false;
  }
}

/** The plugin's events, once: a token (new, or changed by FCM) goes to the API; an alert syncs. */
function listen(): void {
  if (listening) return;
  listening = true;
  void PushNotifications.addListener("registration", ({ value }) => {
    if (!owner) return;
    void apiClient(owner.session)
      .subscribePush({ fcm: value, lang: owner.lang })
      .catch((err: unknown) =>
        log.warn("native alerts not saved", { error: err instanceof Error ? err.name : typeof err }),
      );
  });
  void PushNotifications.addListener("registrationError", ({ error }) =>
    log.warn("native alerts not registered", { error }),
  );
  const arrived = () => {
    for (const fn of arrivals) fn();
  };
  void PushNotifications.addListener("pushNotificationReceived", arrived);
  void PushNotifications.addListener("pushNotificationActionPerformed", arrived);
}

/** Runs `fn` when an alert comes while the app is open, or one is tapped; returns the unsubscribe. */
export function onPushArrived(fn: () => void): () => void {
  arrivals.add(fn);
  return () => {
    arrivals.delete(fn);
  };
}

/** Registers with FCM on the "Job alerts" channel; the token comes back through the `registration` event. */
async function register(session: Session, lang: Lang): Promise<void> {
  owner = { session, lang };
  listen();
  await PushNotifications.createChannel({ id: CHANNEL, name: t(lang, "alerts.channel"), importance: IMPORTANCE_HIGH });
  await PushNotifications.register();
}

/** Whether the API can send this app its alerts: it has the Firebase account (ADR 0067). */
const nativeOn = async (session: Session): Promise<boolean> => (await apiClient(session).pushKey()).native === true;

/** Where the app's alerts stand, without asking the owner anything. */
export async function nativeAlertState(session: Session | undefined): Promise<AlertState> {
  if (!session || !(await nativeOn(session))) return AlertState.unavailable;
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === DENIED) return AlertState.blocked;
  return receive === GRANTED && isOn() ? AlertState.on : AlertState.off;
}

/** Turns the app's alerts on: Android asks the owner (13 and later), then the app registers with FCM. */
export async function turnOnNative(session: Session): Promise<AlertState> {
  if (!(await nativeOn(session))) return AlertState.unavailable;
  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== GRANTED) return AlertState.blocked;
  try {
    await register(session, owner?.lang ?? DEFAULT_LANG);
  } catch (err) {
    log.warn("native alerts not available", { error: err instanceof Error ? err.name : typeof err });
    return AlertState.unavailable;
  }
  rememberOn(true);
  return AlertState.on;
}

/** Turns them off: FCM forgets this app's token, and the API the address. */
export async function turnOffNative(session: Session): Promise<AlertState> {
  rememberOn(false);
  await PushNotifications.unregister().catch(() => undefined);
  await apiClient(session).unsubscribePush();
  return AlertState.off;
}

/** On each open with alerts on: registers again, so the API has the current token and the owner's language. */
export async function refreshNative(session: Session, lang: Lang): Promise<void> {
  owner = { session, lang };
  if (!isOn()) return;
  try {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === GRANTED) await register(session, lang);
  } catch (err) {
    log.warn("native alerts not refreshed", { error: err instanceof Error ? err.name : typeof err });
  }
}
