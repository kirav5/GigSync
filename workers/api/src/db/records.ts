import { DONE } from "../records/sides.js";

/**
 * A worker's record for `worker_profiles p` (ADR 0036, 0038 §3), to sit beside the card columns: computed from stored
 * job records the worker finished (status done), so agreed work still ahead and cancelled jobs are left out. A
 * one-sided job is stored only once the household's agree was delivered, so it counts here without the household's
 * consent. DONE is a code constant, not input, so it is safe in the text; job_records_worker serves every subquery.
 */
const COUNTED = `FROM job_records j WHERE j.worker_id = p.user_id AND j.status = '${DONE}'`;
export const RECORD_COLUMNS = `p.show_record,
  (SELECT count(*) ${COUNTED})::int AS record_jobs,
  (SELECT count(j.stars) ${COUNTED})::int AS record_rated,
  (SELECT round(avg(j.stars) * 10) ${COUNTED})::int AS record_average_tenths`;

/** The columns RECORD_COLUMNS selects. */
export interface RecordRow {
  show_record: boolean;
  record_jobs: number;
  record_rated: number;
  /** Average stars times AVERAGE_SCALE, rounded; null when no job was rated. */
  record_average_tenths: number | null;
}
