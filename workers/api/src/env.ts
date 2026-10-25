import type { Mailbox } from "@gigsync/worker-mailbox";

export interface Env {
  DIRECTORY: D1Database;
  MAILBOX: DurableObjectNamespace<Mailbox>;
  /** Caps sign-in attempts per client IP; the per-number cap lives in D1 (otp_attempts). */
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
}

/** A secret the Worker cannot work without. Fails the request (500) rather than fall back to a guessable value. */
export function requireSecret(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}
