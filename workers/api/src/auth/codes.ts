import { hmacHex, sameSecret } from "../crypto.js";
import type { Db } from "../db/client.js";

/**
 * One-time sign-in codes (architecture review row 1). A code lives five minutes, is kept only as a hash keyed by the
 * server's secret, works once, and a number gets a new one at most once a minute, so a stranger cannot run up texts
 * to it. Wrong guesses are capped per number by `attempts.ts`, as before.
 */

export const CODE_TTL_MS = 5 * 60_000;
export const RESEND_MS = 60_000;
const CODE_DIGITS = 6;
const CODE_SPACE = 10 ** CODE_DIGITS;
/** The largest multiple of the code space a Uint32 holds: values above it are drawn again, so every code is as likely. */
const FAIR_LIMIT = Math.floor(2 ** 32 / CODE_SPACE) * CODE_SPACE;

/** A uniformly random six-digit code, leading zeros kept. */
export function newCode(): string {
  const draw = new Uint32Array(1);
  do crypto.getRandomValues(draw);
  while ((draw[0] ?? FAIR_LIMIT) >= FAIR_LIMIT);
  return String((draw[0] ?? 0) % CODE_SPACE).padStart(CODE_DIGITS, "0");
}

const codeHash = (key: string, phoneHmac: string, code: string) => hmacHex(key, `${phoneHmac}:${code}`);

/** Keeps a new code for a number; false when the last one was sent less than a minute ago. */
export async function saveCode(db: Db, key: string, phoneHmac: string, code: string, now: Date): Promise<boolean> {
  const hash = await codeHash(key, phoneHmac, code);
  const { rowCount } = await db.query(
    `INSERT INTO otp_codes (phone_hmac, code_hash, sent_at, expires_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone_hmac) DO UPDATE SET code_hash = excluded.code_hash, sent_at = excluded.sent_at,
       expires_at = excluded.expires_at
     WHERE otp_codes.sent_at <= $5`,
    [phoneHmac, hash, now, new Date(now.getTime() + CODE_TTL_MS), new Date(now.getTime() - RESEND_MS)],
  );
  return (rowCount ?? 0) > 0;
}

/** Forgets a number's code, as when it could not be sent. */
export async function dropCode(db: Db, phoneHmac: string): Promise<void> {
  await db.query("DELETE FROM otp_codes WHERE phone_hmac = $1", [phoneHmac]);
}

/** True when the code is the number's live one; it is then used up. */
export async function takeCode(db: Db, key: string, phoneHmac: string, code: string, now: Date): Promise<boolean> {
  const { rows } = await db.query<{ code_hash: string }>(
    "SELECT code_hash FROM otp_codes WHERE phone_hmac = $1 AND expires_at > $2",
    [phoneHmac, now],
  );
  const stored = rows[0]?.code_hash;
  if (!stored || !(await sameSecret(stored, await codeHash(key, phoneHmac, code)))) return false;
  await dropCode(db, phoneHmac);
  return true;
}
