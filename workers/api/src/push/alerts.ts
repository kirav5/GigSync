import { log } from "@gigsync/core/log";
import { isNativePush, type PushAddress, type PushNews } from "@gigsync/protocol";
import type { Env } from "../env.js";
import { type Fcm, fcmOf, fcmWake } from "./fcm.js";
import { type Vapid, vapidOf, Woke, wake } from "./webpush.js";

/**
 * A job message's alerts to every phone of the person it is for: a browser by Web Push (ADR 0043, 0044), the Android
 * app by FCM (ADR 0067). Each half works alone: without the VAPID keys only the Android app is told, without the
 * service account only browsers.
 */

/** Who the API can send as: the VAPID keys for browsers, the service account for the Android app. */
export interface Senders {
  vapid?: Vapid | undefined;
  fcm?: Fcm | undefined;
}

/** The senders the Worker is set up with, or undefined when it has neither and no alert can go. */
export function sendersOf(env: Env): Senders | undefined {
  const vapid = vapidOf(env);
  const fcm = fcmOf(env);
  return vapid || fcm ? { vapid, fcm } : undefined;
}

/** One alert to one device, by the way it takes them; skipped when that way is not set up. */
async function alert(address: PushAddress, news: PushNews, senders: Senders, now: Date): Promise<Woke | undefined> {
  if (isNativePush(address)) return senders.fcm && fcmWake(address, senders.fcm, now);
  return senders.vapid && wake(address, news, senders.vapid, now);
}

/** Tells every device given, together; counts what happened, never the addresses, tokens or news. */
export async function wakeAll(
  addresses: readonly PushAddress[],
  news: PushNews,
  senders: Senders,
  now: Date,
  requestId: string,
): Promise<void> {
  const results = await Promise.all(addresses.map((a) => alert(a, news, senders, now)));
  const count = (w: Woke) => results.filter((r) => r === w).length;
  log.info("push wake-ups", {
    requestId,
    sent: count(Woke.sent),
    gone: count(Woke.gone),
    failed: count(Woke.failed),
    skipped: results.filter((r) => r === undefined).length,
  });
}
