import { z } from "zod";
import { EnvelopeKind } from "./envelope.js";
import { UserId } from "./ids.js";
import { Lang } from "./lang.js";

/**
 * Web Push notifications for job news (ADR 0043, 0044): a device tells the API where its browser's push service
 * reaches it and the keys to encrypt to, and the API sends a push there when a job message lands in its mailbox. The
 * push says only what kind of message came and from whom, encrypted to the phone, so the push service reads nothing;
 * the phone names the sender itself and opens the message. Only the big browsers' push services are accepted, so the
 * API never sends to an address of anyone's choosing.
 */

/** Longest push address the API keeps; real ones run to about 200 characters. */
export const PUSH_ENDPOINT_MAX = 1024;

/** The push services of Chrome, Firefox, Safari and Edge, by host or the end of their host name. */
export const PUSH_HOSTS: readonly string[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
];

const HTTPS = "https:";

/** A push address on one of the known services, over HTTPS. */
export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname;
  return url.protocol === HTTPS && PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
}

const B64URL = /^[A-Za-z0-9_-]+$/;
/** An uncompressed P-256 point (65 bytes) and a 16-byte secret, base64url: a little room over their real lengths. */
const P256DH_MAX = 100;
const AUTH_MAX = 40;

/** The keys a browser gives with its push address (RFC 8291): what a push is encrypted to. */
export const PushKeys = z.object({
  p256dh: z.string().max(P256DH_MAX).regex(B64URL),
  auth: z.string().max(AUTH_MAX).regex(B64URL),
});
export type PushKeys = z.infer<typeof PushKeys>;

/**
 * `PUT /devices/me/push`: where this device's browser takes pushes, and its keys. Without keys (an app from before
 * ADR 0044) the pushes stay empty and the phone shows a plain "something new".
 */
export const PushSubscribe = z.object({
  endpoint: z.string().max(PUSH_ENDPOINT_MAX).refine(isPushEndpoint, "not a known push service"),
  keys: PushKeys.optional(),
});
export type PushSubscribe = z.infer<typeof PushSubscribe>;

/** Longest FCM registration token the API keeps; real ones run to about 160 characters. */
export const FCM_TOKEN_MAX = 512;
/** An FCM token's characters: letters, digits, and the few marks Google puts in them. */
const FCM_TOKEN = /^[A-Za-z0-9_:-]+$/;

/**
 * `PUT /devices/me/push` from the Android app (ADR 0067): the token Firebase Cloud Messaging gave it, and the language
 * its alert is worded in. The alert says only that something came, so there are no keys to encrypt to.
 */
export const NativePush = z.object({
  fcm: z.string().min(1).max(FCM_TOKEN_MAX).regex(FCM_TOKEN),
  lang: Lang,
});
export type NativePush = z.infer<typeof NativePush>;

/** Where a device takes alerts: a browser's Web Push subscription, or the Android app's FCM token. */
export const PushAddress = z.union([PushSubscribe, NativePush]);
export type PushAddress = z.infer<typeof PushAddress>;

/** Whether an address is the Android app's FCM token rather than a browser's subscription. */
export const isNativePush = (address: PushAddress): address is NativePush => "fcm" in address;

/**
 * `GET /devices/push-key`: the API's public VAPID key, for the browser to subscribe with (absent: browsers get no
 * alerts), and whether it can send to the Android app by FCM (ADR 0067).
 */
export const PushKey = z.object({ public_key: z.string().min(1).max(200).optional(), native: z.boolean().optional() });
export type PushKey = z.infer<typeof PushKey>;

/** What a push tells the phone, encrypted to it: the kind of message that came, and who sent it. Nothing more. */
export const PushNews = z.object({ kind: EnvelopeKind, from: UserId });
export type PushNews = z.infer<typeof PushNews>;
