import type { Mailbox } from "@gigsync/worker-mailbox";

export interface Env {
  /** Hyperdrive in front of the Neon directory database (users, devices, sessions, sign-in attempts). */
  DIRECTORY: Hyperdrive;
  MAILBOX: DurableObjectNamespace<Mailbox>;
  /** Caps sign-in attempts per client IP; the per-number cap lives in the directory (otp_attempts). */
  OTP_RATE_LIMIT: RateLimit;
  /** "local" in .dev.vars; the only environment where LOG_PII can take effect. */
  ENVIRONMENT: string;
  /** debug | info | warn | error. Unset or unknown means info. */
  LOG_LEVEL?: string;
  /** "true" prints values marked pii() in logs. Ignored unless ENVIRONMENT is "local". */
  LOG_PII?: string;
  /** Comma-separated origins allowed to call the API from a browser or webview (the website and the phone apps). */
  ALLOWED_ORIGINS?: string;
  /** Secret: the code that always verifies until the SMS gateway exists. Unset means nobody can sign in. */
  DEV_OTP?: string;
  /** Secret: HMAC key for phone-number hashes. `wrangler secret put PHONE_HMAC_KEY`. */
  PHONE_HMAC_KEY?: string;
  /** Secret: the key admin-only routes (setting a mentor's vouched badge) expect. Unset means nobody is admin. */
  ADMIN_KEY?: string;
  /** Public: the VAPID key phones subscribe to pushes with (base64url P-256 point). Unset means push is off. */
  VAPID_PUBLIC_KEY?: string;
  /** Secret: its private half (base64url). `node scripts/vapid-keys.mjs` makes both; `wrangler secret put`. */
  VAPID_PRIVATE_KEY?: string;
  /** Public: who push services may contact about these pushes, `mailto:` or an `https:` page. */
  VAPID_SUBJECT?: string;
}

/** A secret the Worker cannot work without. Fails the request (500) rather than fall back to a guessable value. */
export function requireSecret(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}
