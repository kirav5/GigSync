import { AVERAGE_SCALE, MIN_RATED, type WorkerRecord } from "@gigsync/protocol";
import type { RecordRow } from "../db/records.js";

/**
 * The record a card is served with, whatever the worker's switch: nothing until a job is stored, and the average only
 * once MIN_RATED jobs were rated. Never used to sort, filter or rank.
 */
export function recordOf(r: RecordRow): WorkerRecord | undefined {
  if (r.record_jobs === 0) return undefined;
  const counts = { jobs: r.record_jobs, rated: r.record_rated };
  if (r.record_rated < MIN_RATED || r.record_average_tenths === null) return counts;
  return { ...counts, average: r.record_average_tenths / AVERAGE_SCALE };
}
