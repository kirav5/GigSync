import { type DeviceId, type EngagementId, JobSubmitState, Role, type UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** One side's submission as stored. */
export interface Submission {
  engagement: EngagementId;
  user: UserId;
  counterpart: UserId;
  role: Role;
  fields: string;
  terms_hash: string;
  sig: string;
  device: DeviceId;
  at: Date;
}

/**
 * Serialises submissions for one engagement until the transaction ends, so two sides submitting at once cannot both
 * miss each other. Call first inside the submission's transaction.
 */
export async function lockEngagement(db: Db, engagement: EngagementId): Promise<void> {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [engagement]);
}

/** Stores or replaces the caller's submission as pending. */
export async function saveSubmission(db: Db, s: Submission, state: JobSubmitState): Promise<void> {
  await db.query(
    `INSERT INTO job_submissions (engagement_id, user_id, counterpart_id, role, fields, terms_hash, sig, device_id,
       state, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (engagement_id, user_id) DO UPDATE SET counterpart_id = excluded.counterpart_id,
       role = excluded.role, fields = excluded.fields, terms_hash = excluded.terms_hash, sig = excluded.sig,
       device_id = excluded.device_id, state = excluded.state, submitted_at = excluded.submitted_at`,
    [s.engagement, s.user, s.counterpart, s.role, s.fields, s.terms_hash, s.sig, s.device, state, s.at],
  );
}

/** The other side's submission naming `user` as its counterpart, or undefined when it has not arrived. */
export async function otherSubmission(
  db: Db,
  engagement: EngagementId,
  other: UserId,
  user: UserId,
): Promise<{ fields: string } | undefined> {
  const { rows } = await db.query<{ fields: string }>(
    "SELECT fields FROM job_submissions WHERE engagement_id = $1 AND user_id = $2 AND counterpart_id = $3",
    [engagement, other, user],
  );
  return rows[0];
}

/** Sets the state of both sides' submissions for an engagement. */
export async function setStates(
  db: Db,
  engagement: EngagementId,
  sides: readonly UserId[],
  state: JobSubmitState,
): Promise<void> {
  await db.query("UPDATE job_submissions SET state = $3 WHERE engagement_id = $1 AND user_id = ANY($2)", [
    engagement,
    sides,
    state,
  ]);
}

/** The fields of a stored job's submissions, or undefined when the engagement has no stored job. */
export async function storedFields(
  db: Db,
  engagement: EngagementId,
  stored: JobSubmitState,
): Promise<string | undefined> {
  const { rows } = await db.query<{ fields: string }>(
    "SELECT fields FROM job_submissions WHERE engagement_id = $1 AND state = $2 LIMIT 1",
    [engagement, stored],
  );
  return rows[0]?.fields;
}

/** The worker's submission naming `household` that still waits for the household's agree, or undefined. */
export async function waitingWorkerSide(
  db: Db,
  engagement: EngagementId,
  worker: UserId,
  household: UserId,
): Promise<Submission | undefined> {
  const { rows } = await db.query<Submission>(
    `SELECT engagement_id AS engagement, user_id AS "user", counterpart_id AS counterpart, role, fields, terms_hash,
       sig, device_id AS device, submitted_at AS at
     FROM job_submissions
     WHERE engagement_id = $1 AND user_id = $2 AND counterpart_id = $3 AND role = $4 AND state = $5`,
    [engagement, worker, household, Role.enum.provider, JobSubmitState.enum.pending],
  );
  return rows[0];
}
