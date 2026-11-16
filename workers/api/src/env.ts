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
  /**
   * Public: the Firebase project whose phone sign-in the app uses to send SMS codes; ID tokens must be issued for it.
   * Unset or empty means `/v1/auth/phone/verify` answers 503 and only the DEV_OTP path signs in.
   */
  FIREBASE_PROJECT_ID?: string;
  /** Secret: HMAC key for phone-number hashes. `wrangler secret put PHONE_HMAC_KEY`. */
  PHONE_HMAC_KEY?: string;
  /** Secret: the key admin-only routes (setting a mentor's vouched badge) expect. Unset means nobody is admin. */
  ADMIN_KEY?: string;
  /** Public: the VAPID key phones subscribe to pushes with (base64url P-256 point). Unset means push is off. */
  VAPID_PUBLIC_KEY?: string;
  /** Secret: its private half (base64url). `node scripts/vapid-keys.mjs` makes both; `wrangler secret put`. */
  VAPID_PRIVATE_KEY?: string;
  /**
   * Secret: the Firebase service account's key, the JSON Google gives, that the Android app's alerts are sent with (ADR
   * 0067). `wrangler secret put FCM_SERVICE_ACCOUNT`. Unset means only browsers get alerts.
   */
  FCM_SERVICE_ACCOUNT?: string;
  /** Caps geocoding lookups per user (ADR 0045), so one account cannot spend the provider's allowance. */
  GEO_RATE_LIMIT: RateLimit;
  /** Secret: the Ola Maps key the geocoding routes call with (ADR 0045). Unset means they answer 503. */
  OLA_MAPS_API_KEY?: string;
  /** Caps calls to GigSync's model per user (ADR 0052): a chat turn makes a few, not hundreds. */
  MODEL_RATE_LIMIT: RateLimit;
  /**
   * Public: where GigSync's model answers (ADR 0052), Ollama's origin: the Cloudflare Tunnel's hostname in the pilot,
   * the Mac Studio's LAN address locally. Unset means the model route answers 503 and phones use their own model.
   */
  MODEL_ORIGIN?: string;
  /** Public: the model Ollama serves there, e.g. `qwen3:30b-a3b-instruct-2507-q4_K_M`. */
  MODEL_NAME?: string;
  /** Secret: the Cloudflare Access service token's id, when the tunnel is behind Access. */
  MODEL_ACCESS_ID?: string;
  /** Secret: that token's secret. */
  MODEL_ACCESS_SECRET?: string;
  /**
   * Public: which of the directory's live cities are served (ADR 0061), as a comma list of keys ("bengaluru,kanpur").
   * Unset means all of them; `*` means every place, inside a city or not, for development and testing anywhere.
   */
  LIVE_CITIES?: string;
  /** Public: who push services may contact about these pushes, `mailto:` or an `https:` page. */
  VAPID_SUBJECT?: string;
}

/** A secret the Worker cannot work without. Fails the request (500) rather than fall back to a guessable value. */
export function requireSecret(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}
