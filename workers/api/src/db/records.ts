import {
  AVERAGE_SCALE,
  type BoardProfile,
  type EnvelopeHeader,
  EnvelopeKind,
  type WorkerRecord,
} from "@gigsync/protocol";
import { CAME_BACK_JOBS, type Counts } from "../record/cap.js";
import type { Db } from "./client.js";

const K = EnvelopeKind.enum;

/** Envelope kinds that feed a worker's record (ADR 0036): signatures on the terms, and reviews. */
export const COUNTED_KINDS: ReadonlySet<EnvelopeKind> = new Set([K.agree, K.review]);

/**
 * Counts one delivered envelope toward its recipient's record. Idempotent: each fact is a row with a primary key, so a
 * retried or duplicated envelope adds nothing. A review counts only on an engagement both sides had signed.
 */
export async function countDelivery(db: Db, h: EnvelopeHeader): Promise<void> {
  if (h.kind === K.agree) {
    await db.query(
      `INSERT INTO engagement_signatures (signer_id, counterpart_id, engagement_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [h.from.user, h.to.user, h.engagement],
    );
    return;
  }
  if (h.kind === K.review) {
    await db.query(
      `INSERT INTO engagement_reviews (subject_id, reviewer_id, engagement_id)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM signed_engagements s
         WHERE s.user_id = $1 AND s.counterpart_id = $2 AND s.engagement_id = $3)
       ON CONFLICT DO NOTHING`,
      [h.to.user, h.from.user, h.engagement],
    );
  }
}

/**
 * The published record and the server's counts for `worker_profiles p`, to sit beside CARD_COLUMNS. Counts are only
 * run for a worker who published a record. CAME_BACK_JOBS is a code constant, not input, so it is safe in the text.
 */
export const RECORD_COLUMNS = `p.record_jobs, p.record_rated, p.record_average_tenths, p.record_came_back,
  CASE WHEN p.record_jobs IS NOT NULL THEN
    (SELECT count(*) FROM signed_engagements s WHERE s.user_id = p.user_id)::int END AS seen_jobs,
  CASE WHEN p.record_jobs IS NOT NULL THEN
    (SELECT count(*) FROM engagement_reviews v WHERE v.subject_id = p.user_id)::int END AS seen_rated,
  CASE WHEN p.record_jobs IS NOT NULL THEN
    (SELECT count(*) FROM (SELECT 1 FROM signed_engagements s WHERE s.user_id = p.user_id
       GROUP BY s.counterpart_id HAVING count(*) >= ${CAME_BACK_JOBS}) h)::int END AS seen_came_back`;

/** The columns RECORD_COLUMNS selects; all NULL for a worker who hid their record or published none. */
export interface RecordRow {
  record_jobs: number | null;
  record_rated: number | null;
  record_average_tenths: number | null;
  record_came_back: number | null;
  seen_jobs: number | null;
  seen_rated: number | null;
  seen_came_back: number | null;
}

/** The record as the worker published it, or undefined when hidden or never published. */
export function publishedOf(r: RecordRow): WorkerRecord | undefined {
  if (r.record_jobs === null || r.record_rated === null || r.record_came_back === null) return undefined;
  const base = { jobs: r.record_jobs, rated: r.record_rated, came_back: r.record_came_back };
  return r.record_average_tenths === null ? base : { ...base, average: r.record_average_tenths / AVERAGE_SCALE };
}

/** What the server counted for the worker. */
export const seenOf = (r: RecordRow): Counts => ({
  jobs: r.seen_jobs ?? 0,
  rated: r.seen_rated ?? 0,
  came_back: r.seen_came_back ?? 0,
});

/** The worker_profiles record columns for a published card, in order: jobs, rated, average in tenths, came back. */
export function recordValues(p: BoardProfile): (number | null)[] {
  const r = p.show_record === false ? undefined : p.record;
  if (!r) return [null, null, null, null];
  const tenths = r.average === undefined ? null : Math.round(r.average * AVERAGE_SCALE);
  return [r.jobs, r.rated, tenths, r.came_back];
}
