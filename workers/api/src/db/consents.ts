import { type ConsentState, RECORDS_NOTICE_VERSION, type UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** The consents purpose for job records (ADR 0038 §5). */
const RECORDS_PURPOSE = "job_records";

interface ConsentRow {
  notice_version: string;
  granted_at: Date;
}

const stateOf = (r: ConsentRow): ConsentState => ({
  notice_version: r.notice_version,
  accepted_at: r.granted_at.toISOString(),
  current: r.notice_version === RECORDS_NOTICE_VERSION,
});

/** Records that the person accepted the current notice; accepting again renews it. */
export async function acceptNotice(db: Db, user: UserId, at: Date): Promise<ConsentState> {
  const { rows } = await db.query<ConsentRow>(
    `INSERT INTO consents (user_id, purpose, notice_version, granted_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, purpose) DO UPDATE SET notice_version = excluded.notice_version,
       granted_at = excluded.granted_at, withdrawn_at = NULL
     RETURNING notice_version, granted_at`,
    [user, RECORDS_PURPOSE, RECORDS_NOTICE_VERSION, at],
  );
  const [r] = rows;
  if (!r) throw new Error("consent upsert returned no row");
  return stateOf(r);
}

/** What the person accepted and has not withdrawn, or undefined. */
export async function consentOf(db: Db, user: UserId): Promise<ConsentState | undefined> {
  const { rows } = await db.query<ConsentRow>(
    `SELECT notice_version, granted_at FROM consents
     WHERE user_id = $1 AND purpose = $2 AND withdrawn_at IS NULL`,
    [user, RECORDS_PURPOSE],
  );
  const [r] = rows;
  return r && stateOf(r);
}

/** Withdraws the person's consent; call in the deletion's transaction. */
export async function withdrawConsent(db: Db, user: UserId, at: Date): Promise<void> {
  await db.query("UPDATE consents SET withdrawn_at = $3 WHERE user_id = $1 AND purpose = $2 AND withdrawn_at IS NULL", [
    user,
    RECORDS_PURPOSE,
    at,
  ]);
}
