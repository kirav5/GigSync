import { t } from "@gigsync/core";
import { ContentType, Header, HttpMethod } from "@gigsync/core/http";
import type { NativePush } from "@gigsync/protocol";
import { z } from "zod";
import type { Env } from "../env.js";
import { b64url } from "./b64.js";
import { Woke } from "./webpush.js";

/**
 * The Android app's alerts through Firebase Cloud Messaging's HTTP v1 API (ADR 0067). Each is a notification Android
 * shows itself, app running or not: "GigSync" and one fixed line in the owner's language, and nothing else, so Google
 * learns only that this phone got an alert. The API signs in as the project's service account (RS256, WebCrypto only)
 * and keeps the access token until it nearly runs out.
 */

/** The service account's key as Google gives it, of which only these fields are used. */
const ServiceAccount = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
});
export type Fcm = z.infer<typeof ServiceAccount>;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const sendUrl = (project: string) => `https://fcm.googleapis.com/v1/projects/${project}/messages:send`;
/** A signed request for a token lives an hour at most; the token Google gives back, about as long. */
const ASSERTION_SECONDS = 3600;
/** A token is used until a minute before it runs out, so none expires on the way. */
const EARLY_SECONDS = 60;
const MS = 1000;
/** As Web Push: a phone that is off gets the alert within a day, after which the news waits for the app. */
const TTL = "86400s";
const HIGH = "high";
const TITLE = "GigSync";
/** Every alert carries the same tag, so a burst of messages is one line in the tray, not five. */
const TAG = "gigsync-job";
/** The Android channel the app creates (adapters/push.ts), named "Job alerts" in the owner's language. */
export const FCM_CHANNEL = "job-alerts";
const RS256 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
const PEM_LINES = /-----[A-Z ]+-----|\s/g;
/** FCM says a token is gone for good with these: not found, or the app was removed. */
const GONE: ReadonlySet<number> = new Set([404]);
const UNREGISTERED = "UNREGISTERED";

/** The service account from the Worker's secret, or undefined while native alerts are not set up. */
export function fcmOf(env: Env): Fcm | undefined {
  if (!env.FCM_SERVICE_ACCOUNT) return undefined;
  try {
    const parsed = ServiceAccount.safeParse(JSON.parse(env.FCM_SERVICE_ACCOUNT));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const json64 = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

/** The PEM private key as WebCrypto takes it: its base64 body, decoded. */
function pkcs8(pem: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(pem.replace(PEM_LINES, "")), (c) => c.charCodeAt(0));
  return bytes.buffer;
}

/** The signed request for an access token (RFC 7523): who the account is, for what, until when. */
export async function assertionFor(fcm: Fcm, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / MS);
  const claims = { iss: fcm.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + ASSERTION_SECONDS };
  const unsigned = `${json64({ alg: "RS256", typ: "JWT" })}.${json64(claims)}`;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(fcm.private_key), RS256, false, ["sign"]);
  const sig = await crypto.subtle.sign(RS256, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
}

const TokenAnswer = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });

/** The access token kept in this Worker between requests, with when to stop using it. */
let cached: { account: string; token: string; until: number } | undefined;

/** Forgets the kept access token: the tests start each case afresh. */
export const forgetFcmToken = () => {
  cached = undefined;
};

/** An access token for FCM: the kept one while it lasts, else a new one from Google. */
async function accessToken(fcm: Fcm, now: Date): Promise<string> {
  if (cached && cached.account === fcm.client_email && cached.until > now.getTime()) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: HttpMethod.post,
    body: new URLSearchParams({ grant_type: GRANT, assertion: await assertionFor(fcm, now) }),
  });
  if (!res.ok) throw new Error(`FCM sign-in refused: ${res.status}`);
  const answer = TokenAnswer.parse(await res.json());
  const until = now.getTime() + (answer.expires_in - EARLY_SECONDS) * MS;
  cached = { account: fcm.client_email, token: answer.access_token, until };
  return answer.access_token;
}

/** The message FCM sends: a notification Android shows, in the owner's language, with no data at all. */
export function fcmMessage(address: NativePush) {
  return {
    message: {
      token: address.fcm,
      notification: { title: TITLE, body: t(address.lang, "alerts.native_body") },
      android: {
        priority: HIGH,
        ttl: TTL,
        notification: { tag: TAG, channel_id: FCM_CHANNEL },
      },
    },
  };
}

const FcmError = z.object({ error: z.object({ details: z.array(z.object({ errorCode: z.string() })).optional() }) });

/** Whether FCM's answer says the token is gone for good (the app was removed, or the token replaced). */
async function goneToken(res: Response): Promise<boolean> {
  if (GONE.has(res.status)) return true;
  const parsed = FcmError.safeParse(await res.json().catch(() => undefined));
  return parsed.success && (parsed.data.error.details ?? []).some((d) => d.errorCode === UNREGISTERED);
}

/** One alert to one Android device. */
export async function fcmWake(address: NativePush, fcm: Fcm, now: Date): Promise<Woke> {
  try {
    const res = await fetch(sendUrl(fcm.project_id), {
      method: HttpMethod.post,
      headers: {
        [Header.authorization]: `Bearer ${await accessToken(fcm, now)}`,
        [Header.contentType]: ContentType.json,
      },
      body: JSON.stringify(fcmMessage(address)),
    });
    if (res.ok) return Woke.sent;
    return (await goneToken(res)) ? Woke.gone : Woke.failed;
  } catch {
    return Woke.failed;
  }
}
