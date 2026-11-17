import type { Db } from "./client.js";

/** How long a sent code signs in. Long enough to open WhatsApp and come back; short enough that a seen code goes stale. */
export const CODE_TTL_MS = 5 * 60_000;
/** The wait before the same number is sent another code; the app's Send again counts down the same 30 seconds. */
export const RESEND_AFTER_MS = 30_000;
/** Codes one number may be sent per window: each costs money, and a person needs two or three at most. */
const MAX_SENDS = 5;
const SEND_WINDOW_MS = 60 * 60_000;

/** A number's pending code, as kept: only its hash. */
export interface StoredCode {
  code_hash: string;
  expires_at: Date;
}

const before = (now: Date, ms: number) => new Date(now.getTime() - ms);

/**
 * Keeps `codeHash` as the number's one pending code, replacing any before it, unless the number was sent one too
 * recently or has had its codes for this window. True when kept, and so the code may be sent.
 */
export async function keepCode(db: Db, phoneHmac: string, codeHash: string, now: Date): Promise<boolean> {
  const { rows } = await db.query(
    `INSERT INTO otp_codes (phone_hmac, code_hash, sent_at, expires_at, sends, window_start)
     VALUES ($1, $2, $3, $4, 1, $3)
     ON CONFLICT (phone_hmac) DO UPDATE SET
       code_hash = excluded.code_hash,
       sent_at = excluded.sent_at,
       expires_at = excluded.expires_at,
       sends = CASE WHEN otp_codes.window_start <= $6 THEN 1 ELSE otp_codes.sends + 1 END,
       window_start = CASE WHEN otp_codes.window_start <= $6 THEN excluded.window_start ELSE otp_codes.window_start END
     WHERE otp_codes.sent_at <= $5 AND (otp_codes.window_start <= $6 OR otp_codes.sends < $7)
     RETURNING phone_hmac`,
    [
      phoneHmac,
      codeHash,
      now,
      new Date(now.getTime() + CODE_TTL_MS),
      before(now, RESEND_AFTER_MS),
      before(now, SEND_WINDOW_MS),
      MAX_SENDS,
    ],
  );
  return rows.length > 0;
}

/** The number's pending code, when it has one that has not expired. */
export async function pendingCode(db: Db, phoneHmac: string, now: Date): Promise<StoredCode | undefined> {
  const { rows } = await db.query<StoredCode>(
    "SELECT code_hash, expires_at FROM otp_codes WHERE phone_hmac = $1 AND expires_at > $2",
    [phoneHmac, now],
  );
  return rows[0];
}

/** Forgets the number's code once it signed in, or when it could not be sent (so asking again is not held up). */
export async function dropCode(db: Db, phoneHmac: string): Promise<void> {
  await db.query("DELETE FROM otp_codes WHERE phone_hmac = $1", [phoneHmac]);
}
