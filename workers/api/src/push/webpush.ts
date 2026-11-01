import { Header, HttpMethod } from "@gigsync/core/http";
import { log } from "@gigsync/core/log";
import { EnvelopeKind, isPushEndpoint } from "@gigsync/protocol";
import type { Env } from "../env.js";

/**
 * Empty Web Push wake-ups (RFC 8030, signed with VAPID, RFC 8292): the push carries no data at all, so nothing about a
 * job ever passes through Google's, Apple's or Mozilla's push service. The phone's service worker shows a plain
 * "your job has an update" and the app opens its own sealed messages. WebCrypto only, so no library on the Worker.
 */

/** How long a push service keeps a wake-up for a phone that is off: a day, after which the news waits for the app. */
const TTL_SECONDS = 86_400;
/** A VAPID token's life: push services take at most 24 hours. */
const TOKEN_SECONDS = 12 * 3600;
const MS = 1000;
const K = EnvelopeKind.enum;

/**
 * The messages a person wants to hear about even with the app closed: a new request or question, a deal to sign or
 * signed, the worker on the way or done, money asked or paid, a rating, a cancellation, a problem, and the mentor and
 * colleague notes meant for them. Not the agents' own back-and-forth (responses, quotes, counters), which runs by itself
 * every few seconds while they bargain.
 */
export const WAKE_KINDS: ReadonlySet<EnvelopeKind> = new Set([
  K.request,
  K.clarify,
  K.agree,
  K.contact_release,
  K.update,
  K.delivery,
  K.review,
  K.cancel,
  K.payment_request,
  K.payment_record,
  K.problem,
  K.referral,
  K.work_offer,
  K.landing_request,
  K.mentor_offer,
  K.colleague_note,
]);

/** RFC 8030's headers, by their names. */
const PushHeader = { ttl: "TTL", urgency: "Urgency", contentLength: "Content-Length" } as const;
const HIGH = "high";
const EMPTY = "0";
const ES256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;
/** An uncompressed P-256 point: 0x04, then x and y of 32 bytes each. */
const POINT_X = [1, 33] as const;
const POINT_Y = [33, 65] as const;
/** Push services say an address is gone for good with these. */
const GONE: ReadonlySet<number> = new Set([404, 410]);

/** The API's VAPID identity: the public point (base64url, 65 bytes), the private scalar (base64url), and a contact. */
export interface Vapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** What one wake-up came to: sent, the address is gone (the phone subscribes again when it opens), or failed. */
export const Woke = { sent: "sent", gone: "gone", failed: "failed" } as const;
export type Woke = (typeof Woke)[keyof typeof Woke];

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

function fromB64url(text: string): Uint8Array {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const json64 = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

/** The VAPID keys from the Worker's settings, or undefined while push is not set up (then nothing is sent). */
export function vapidOf(env: Env): Vapid | undefined {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : undefined;
}

async function signingKey(vapid: Vapid): Promise<CryptoKey> {
  const point = fromB64url(vapid.publicKey);
  const jwk = {
    kty: "EC",
    crv: ES256.namedCurve,
    d: vapid.privateKey,
    x: b64url(point.slice(...POINT_X)),
    y: b64url(point.slice(...POINT_Y)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, ES256, false, ["sign"]);
}

/** The `Authorization` header for one push service: a VAPID token for its origin, and the public key. */
export async function vapidAuthorization(endpoint: string, vapid: Vapid, now: Date): Promise<string> {
  const claims = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(now.getTime() / MS) + TOKEN_SECONDS,
    sub: vapid.subject,
  };
  const unsigned = `${json64({ typ: "JWT", alg: "ES256" })}.${json64(claims)}`;
  const sig = await crypto.subtle.sign(SHA256, await signingKey(vapid), new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64url(new Uint8Array(sig))}, k=${vapid.publicKey}`;
}

/** One empty wake-up to one device's push address. */
export async function wake(endpoint: string, vapid: Vapid, now: Date): Promise<Woke> {
  if (!isPushEndpoint(endpoint)) return Woke.failed;
  try {
    const res = await fetch(endpoint, {
      method: HttpMethod.post,
      headers: {
        [Header.authorization]: await vapidAuthorization(endpoint, vapid, now),
        [PushHeader.ttl]: String(TTL_SECONDS),
        [PushHeader.urgency]: HIGH,
        [PushHeader.contentLength]: EMPTY,
      },
    });
    if (GONE.has(res.status)) return Woke.gone;
    return res.ok ? Woke.sent : Woke.failed;
  } catch {
    return Woke.failed;
  }
}

/** Wakes every device given, together; counts what happened, never the addresses. */
export async function wakeAll(endpoints: readonly string[], vapid: Vapid, now: Date, requestId: string): Promise<void> {
  const results = await Promise.all(endpoints.map((e) => wake(e, vapid, now)));
  const count = (w: Woke) => results.filter((r) => r === w).length;
  log.info("push wake-ups", { requestId, sent: count(Woke.sent), gone: count(Woke.gone), failed: count(Woke.failed) });
}
