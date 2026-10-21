/** Wrong codes allowed per number in one window. Five tries at a 6-digit code is a 1-in-200,000 chance. */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

const windowFloor = (now: Date) => new Date(now.getTime() - WINDOW_MS).toISOString();

/** True when this number has used up its wrong codes for the current window. */
export async function isLocked(db: D1Database, phoneHmac: string, now: Date): Promise<boolean> {
  const row = await db
    .prepare("SELECT failures FROM otp_attempts WHERE phone_hmac = ? AND window_start > ?")
    .bind(phoneHmac, windowFloor(now))
    .first<{ failures: number }>();
  return (row?.failures ?? 0) >= MAX_FAILURES;
}

/** Counts one wrong code. Once the window has passed, the count starts again at one. */
export async function recordFailure(db: D1Database, phoneHmac: string, now: Date): Promise<void> {
  const floor = windowFloor(now);
  await db
    .prepare(
      `INSERT INTO otp_attempts (phone_hmac, failures, window_start) VALUES (?, 1, ?)
       ON CONFLICT (phone_hmac) DO UPDATE SET
         failures = CASE WHEN window_start <= ? THEN 1 ELSE failures + 1 END,
         window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`,
    )
    .bind(phoneHmac, now.toISOString(), floor, floor)
    .run();
}

/** Forgets the count after a successful sign-in. A statement, so it runs inside the sign-in batch. */
export function clearFailures(db: D1Database, phoneHmac: string): D1PreparedStatement {
  return db.prepare("DELETE FROM otp_attempts WHERE phone_hmac = ?").bind(phoneHmac);
}
