import { JobRecordStatus, type UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/**
 * True when `household` is on a job record with `worker` that was not cancelled, and the worker has not blocked them:
 * what lets a household pass the worker on (ADR 0055). One-sided jobs count: they name the household too.
 */
export async function mayRecommend(db: Db, worker: UserId, household: UserId): Promise<boolean> {
  const { rows } = await db.query<{ may: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM job_records WHERE worker_id = $1 AND household_id = $2 AND status <> $3)
       AND NOT EXISTS (SELECT 1 FROM mentor_blocks WHERE blocker_id = $1 AND blocked_id = $2) AS may`,
    [worker, household, JobRecordStatus.enum.cancelled],
  );
  return rows[0]?.may ?? false;
}

/** The name on a worker's board card, or undefined when they have none. */
export async function listedName(db: Db, worker: UserId): Promise<string | undefined> {
  const { rows } = await db.query<{ display_name: string }>(
    "SELECT display_name FROM worker_profiles WHERE user_id = $1",
    [worker],
  );
  return rows[0]?.display_name;
}
