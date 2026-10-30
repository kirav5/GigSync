import { log } from "@gigsync/core/log";
import { type EngagementId, type EnvelopeHeader, EnvelopeKind, JobSubmitState, type UserId } from "@gigsync/protocol";
import { recordAgree } from "../db/agree-signatures.js";
import { type Db, transaction } from "../db/client.js";
import { upsertRecord } from "../db/job-records.js";
import { lockEngagement, saveSubmission, waitingWorkerSide } from "../db/job-submissions.js";
import { columnsOf, fieldsFrom } from "./fields.js";

/**
 * Turns the worker's waiting submission on `engagement` into a one-sided job, now that the household's agree reached
 * her. True when there was one to turn; a submission the household already answered is never waiting.
 */
export async function promoteOnAgree(
  db: Db,
  engagement: EngagementId,
  worker: UserId,
  household: UserId,
  now: Date,
): Promise<boolean> {
  return transaction(db, async () => {
    await lockEngagement(db, engagement);
    const waiting = await waitingWorkerSide(db, engagement, worker, household);
    if (!waiting) return false;
    const fields = fieldsFrom(waiting.fields);
    if (!(await upsertRecord(db, fields, columnsOf(fields.work, fields.terms), false, now))) return false;
    await saveSubmission(db, waiting, JobSubmitState.enum.one_sided);
    return true;
  });
}

/**
 * Records a delivered `agree` from its headers only (ADR 0038 §2) and lets a worker's waiting submission stand alone
 * if this is her household's. Runs for duplicates too (idempotent), never for an expired envelope (the mailbox does
 * not store it) or one between a user and themselves, and never fails the delivery: a failure is logged.
 */
export async function noteDeliveredAgree(db: Db, h: EnvelopeHeader, requestId: string): Promise<void> {
  if (h.kind !== EnvelopeKind.enum.agree || h.from.user === h.to.user || Date.parse(h.expires_at) <= Date.now()) return;
  try {
    await recordAgree(db, h.from.user, h.to.user, h.engagement);
    // The sender may be the household and the recipient the worker whose side is waiting.
    const promoted = await promoteOnAgree(db, h.engagement, h.to.user, h.from.user, new Date());
    if (promoted) log.info("one-sided job stored on agree", { requestId, engagement: h.engagement });
  } catch (err) {
    const { name, message } = err instanceof Error ? err : new Error(String(err));
    log.warn("agree record failed", { requestId, error: name, message });
  }
}
