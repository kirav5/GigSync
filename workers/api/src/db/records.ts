import { CAME_BACK_JOBS, CANCELLED } from "../records/sides.js";

/**
 * A worker's record for `worker_profiles p` (ADR 0038 §3), to sit beside the card columns: computed from stored job
 * records, cancelled ones left out. CAME_BACK_JOBS and CANCELLED are code constants, not input, so they are safe in
 * the text; job_records_worker serves every subquery.
 */
const COUNTED = `FROM job_records j WHERE j.worker_id = p.user_id AND j.status <> '${CANCELLED}'`;
export const RECORD_COLUMNS = `p.show_record,
  (SELECT count(*) ${COUNTED})::int AS record_jobs,
  (SELECT count(j.stars) ${COUNTED})::int AS record_rated,
  (SELECT round(avg(j.stars) * 10) ${COUNTED})::int AS record_average_tenths,
  (SELECT count(*) FROM (SELECT 1 ${COUNTED} AND j.household_id IS NOT NULL
     GROUP BY j.household_id HAVING count(*) >= ${CAME_BACK_JOBS}) h)::int AS record_came_back`;

/** The columns RECORD_COLUMNS selects. */
export interface RecordRow {
  show_record: boolean;
  record_jobs: number;
  record_rated: number;
  /** Average stars times AVERAGE_SCALE, rounded; null when no job was rated. */
  record_average_tenths: number | null;
  record_came_back: number;
}
