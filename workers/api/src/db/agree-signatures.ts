import type { EngagementId, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/**
 * Delivered `agree` headers (ADR 0038 §2, one-sided jobs), in ADR 0036's engagement_signatures: who signed the terms
 * of which engagement to whom, ids only. The mailbox verified the sender's device signature and session before
 * delivering, so a row proves that account signed. The primary key makes a retried envelope a no-op.
 */
export async function recordAgree(
  db: Db,
  signer: UserId,
  counterpart: UserId,
  engagement: EngagementId,
): Promise<void> {
  await db.query(
    `INSERT INTO engagement_signatures (signer_id, counterpart_id, engagement_id) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [signer, counterpart, engagement],
  );
}

/** True when the server delivered `household`'s agree on `engagement` to `worker`. */
export async function householdAgreed(
  db: Db,
  engagement: EngagementId,
  household: UserId,
  worker: UserId,
): Promise<boolean> {
  const { rows } = await db.query<{ agreed: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM engagement_signatures
       WHERE signer_id = $1 AND counterpart_id = $2 AND engagement_id = $3) AS agreed`,
    [household, worker, engagement],
  );
  return rows[0]?.agreed ?? false;
}
