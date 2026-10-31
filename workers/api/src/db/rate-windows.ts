import type { UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** Actions counted in rate_windows; the migration's CHECK lists the same values. */
export const RateAction = { transfer: "transfer", jobSubmit: "job_submit", stars: "stars" } as const;
export type RateAction = (typeof RateAction)[keyof typeof RateAction];

/**
 * Counts one `action` by `user` in the window that started after `windowFloor`, and returns the count including this
 * one. Once the window has passed the count starts again at one.
 */
export async function countHit(
  db: Db,
  user: UserId,
  action: RateAction,
  now: Date,
  windowFloor: Date,
): Promise<number> {
  const { rows } = await db.query<{ hits: number }>(
    `INSERT INTO rate_windows (user_id, action, hits, window_start) VALUES ($1, $2, 1, $3)
     ON CONFLICT (user_id, action) DO UPDATE SET
       hits = CASE WHEN rate_windows.window_start <= $4 THEN 1 ELSE rate_windows.hits + 1 END,
       window_start = CASE WHEN rate_windows.window_start <= $4 THEN excluded.window_start
         ELSE rate_windows.window_start END
     RETURNING hits`,
    [user, action, now, windowFloor],
  );
  return rows[0]?.hits ?? 0;
}
