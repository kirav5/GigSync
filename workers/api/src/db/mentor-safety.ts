import type { ReportReason, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/**
 * Records a report, or replaces the reason and reopens it when this reporter reported this person before. False when
 * the reported person does not exist. The caller has already refused a report of oneself.
 */
export async function report(
  db: Db,
  reporter: UserId,
  reported: UserId,
  reason: ReportReason,
  at: Date,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO mentor_reports (reporter_id, reported_id, reason, created_at)
     SELECT $1, u.user_id, $3, $4 FROM users u WHERE u.user_id = $2
     ON CONFLICT (reporter_id, reported_id) DO UPDATE SET reason = excluded.reason,
       created_at = excluded.created_at, reviewed_at = NULL`,
    [reporter, reported, reason, at],
  );
  return (rowCount ?? 0) > 0;
}

/** Records that these two are never matched again. Idempotent. False when the blocked person does not exist. */
export async function block(db: Db, blocker: UserId, blocked: UserId, at: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO mentor_blocks (blocker_id, blocked_id, created_at)
     SELECT $1, u.user_id, $3 FROM users u WHERE u.user_id = $2
     ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET created_at = mentor_blocks.created_at`,
    [blocker, blocked, at],
  );
  return (rowCount ?? 0) > 0;
}

/** Lifts `blocker`'s own block of `blocked`; a block made the other way round stands. Idempotent. */
export async function unblock(db: Db, blocker: UserId, blocked: UserId): Promise<void> {
  await db.query("DELETE FROM mentor_blocks WHERE blocker_id = $1 AND blocked_id = $2", [blocker, blocked]);
}
