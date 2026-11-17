import { MAX_REQUESTS_PER_DAY, type MessageId, type UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** How long a request counts towards the day's cap, and how long its row is kept after. */
const DAY = "24 hours";
const KEPT = "2 days";

/**
 * Whether `user` may send this request (MAX_REQUESTS_PER_DAY in 24 hours). One already counted is the same message
 * sent again, after a dropped connection, and always goes.
 */
export async function mayRequest(db: Db, user: UserId, id: MessageId): Promise<boolean> {
  const { rows } = await db.query<{ sent: number; again: boolean }>(
    `SELECT count(*)::int AS sent, bool_or(message_id = $2) AS again
       FROM request_log WHERE user_id = $1 AND sent_at > now() - $3::interval`,
    [user, id, DAY],
  );
  const row = rows[0];
  return row?.again === true || (row?.sent ?? 0) < MAX_REQUESTS_PER_DAY;
}

/** Counts a delivered request, once however often it is sent, and drops this sender's rows past keeping. */
export async function noteRequest(db: Db, user: UserId, id: MessageId): Promise<void> {
  await db.query("INSERT INTO request_log (message_id, user_id) VALUES ($1, $2) ON CONFLICT (message_id) DO NOTHING", [
    id,
    user,
  ]);
  await db.query("DELETE FROM request_log WHERE user_id = $1 AND sent_at < now() - $2::interval", [user, KEPT]);
}
