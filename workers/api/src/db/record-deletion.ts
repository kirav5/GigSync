import type { RecordsDeleted, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";
import { withdrawConsent } from "./consents.js";

const countOf = (r: { rowCount: number | null }) => r.rowCount ?? 0;

/**
 * Deletes a person's job records on request (ADR 0038 §5), in one transaction the caller opens. Jobs where they were
 * the worker go with their payments; jobs where they were the household stay on the worker's record without the
 * household's id. Submissions involving them (pending, set aside or the evidence of a stored job) go, as do ADR 0036's
 * id rows, and the consent is withdrawn.
 */
export async function deleteRecords(db: Db, user: UserId, at: Date): Promise<RecordsDeleted> {
  await db.query(
    "DELETE FROM job_payments WHERE engagement_id IN (SELECT engagement_id FROM job_records WHERE worker_id = $1)",
    [user],
  );
  const deleted = countOf(await db.query("DELETE FROM job_records WHERE worker_id = $1", [user]));
  const anonymised = countOf(
    await db.query("UPDATE job_records SET household_id = NULL WHERE household_id = $1", [user]),
  );
  const submissions = countOf(
    await db.query("DELETE FROM job_submissions WHERE user_id = $1 OR counterpart_id = $1", [user]),
  );
  await db.query("DELETE FROM engagement_signatures WHERE signer_id = $1 OR counterpart_id = $1", [user]);
  await db.query("DELETE FROM engagement_reviews WHERE subject_id = $1 OR reviewer_id = $1", [user]);
  await withdrawConsent(db, user, at);
  return { deleted, anonymised, submissions };
}
