import { Header, HttpMethod } from "@gigsync/core/http";
import { EnvelopeKind, isPushEndpoint, type PushNews, type PushSubscribe } from "@gigsync/protocol";
import type { Env } from "../env.js";
import { b64url, fromB64url } from "./b64.js";
import { encryptPush } from "./encrypt.js";

/**
 * Web Push notifications (RFC 8030, signed with VAPID, RFC 8292; ADR 0043, 0044). A push says only what kind of
 * message came and from whom, encrypted to the phone's own keys (RFC 8291), so Google's, Apple's or Mozilla's push
 * service carries bytes it cannot read; nothing of the job's content is in it, as the API never sees that either. The
 * phone's service worker names the sender from what the phone knows and words the notification in its owner's
 * language. A device from before ADR 0044 gave no keys and gets an empty push. WebCrypto only, no library.
 */

/** How long a push service keeps a push for a phone that is off: a day, after which the news waits for the app. */
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
  K.recommended,
  K.referral,
  K.work_offer,
  K.landing_request,
  K.mentor_offer,
  K.colleague_note,
]);

/** RFC 8030's and RFC 8188's headers, by their names. */
const PushHeader = {
  ttl: "TTL",
  urgency: "Urgency",
  contentLength: "Content-Length",
  contentEncoding: "Content-Encoding",
} as const;
const HIGH = "high";
const EMPTY = "0";
const AES128GCM = "aes128gcm";
const OCTETS = "application/octet-stream";
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

/** What one push came to: sent, the address is gone (the phone subscribes again when it opens), or failed. */
export const Woke = { sent: "sent", gone: "gone", failed: "failed" } as const;
export type Woke = (typeof Woke)[keyof typeof Woke];

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

/** The news encrypted to the device, or nothing at all for a device that gave no keys. */
async function bodyFor(
  address: PushSubscribe,
  news: PushNews,
): Promise<{ headers: Record<string, string>; body?: Uint8Array<ArrayBuffer> }> {
  if (!address.keys) return { headers: { [PushHeader.contentLength]: EMPTY } };
  const body = await encryptPush(new TextEncoder().encode(JSON.stringify(news)), address.keys);
  return {
    headers: {
      [PushHeader.contentEncoding]: AES128GCM,
      [Header.contentType]: OCTETS,
      [PushHeader.contentLength]: String(body.length),
    },
    body,
  };
}

/** One push to one device: the news, encrypted to it. */
export async function wake(address: PushSubscribe, news: PushNews, vapid: Vapid, now: Date): Promise<Woke> {
  const { endpoint } = address;
  if (!isPushEndpoint(endpoint)) return Woke.failed;
  try {
    const { headers, body } = await bodyFor(address, news);
    const res = await fetch(endpoint, {
      method: HttpMethod.post,
      headers: {
        ...headers,
        [Header.authorization]: await vapidAuthorization(endpoint, vapid, now),
        [PushHeader.ttl]: String(TTL_SECONDS),
        [PushHeader.urgency]: HIGH,
      },
      ...(body ? { body } : {}),
    });
    if (GONE.has(res.status)) return Woke.gone;
    return res.ok ? Woke.sent : Woke.failed;
  } catch {
    return Woke.failed;
  }
}
