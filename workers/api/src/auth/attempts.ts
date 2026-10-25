import type { Db } from "../db/client.js";

/** Wrong codes allowed per number in one window. Five tries at a 6-digit code is a 1-in-200,000 chance. */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

const windowFloor = (now: Date) => new Date(now.getTime() - WINDOW_MS);

/** True when this number has used up its wrong codes for the current window. */
export async function isLocked(db: Db, phoneHmac: string, now: Date): Promise<boolean> {
  const { rows } = await db.query<{ failures: number }>(
    "SELECT failures FROM otp_attempts WHERE phone_hmac = $1 AND window_start > $2",
    [phoneHmac, windowFloor(now)],
  );
  return (rows[0]?.failures ?? 0) >= MAX_FAILURES;
}

/** Counts one wrong code. Once the window has passed, the count starts again at one. */
export async function recordFailure(db: Db, phoneHmac: string, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO otp_attempts (phone_hmac, failures, window_start) VALUES ($1, 1, $2)
     ON CONFLICT (phone_hmac) DO UPDATE SET
       failures = CASE WHEN otp_attempts.window_start <= $3 THEN 1 ELSE otp_attempts.failures + 1 END,
       window_start = CASE WHEN otp_attempts.window_start <= $3 THEN excluded.window_start ELSE otp_attempts.window_start END`,
    [phoneHmac, now, windowFloor(now)],
  );
}

/** Forgets the count after a successful sign-in. Runs inside the sign-in transaction. */
export async function clearFailures(db: Db, phoneHmac: string): Promise<void> {
  await db.query("DELETE FROM otp_attempts WHERE phone_hmac = $1", [phoneHmac]);
}
