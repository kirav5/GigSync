import { MIN_RATED, type WorkerRecord } from "@gigsync/protocol";

/** A household "came back" once it signed this many jobs with the worker. */
export const CAME_BACK_JOBS = 2;

/** The counts behind a record, without the average. */
export type Counts = Pick<WorkerRecord, "jobs" | "rated" | "came_back">;

/**
 * The record a card is served with (ADR 0036): each published count capped at what the server counted, the average
 * only once MIN_RATED households rated (it cannot be checked, stars are sealed), and no record at all when the worker
 * published none or the server counted no job. Never used to sort, filter or rank.
 */
export function capRecord(published: WorkerRecord | undefined, seen: Counts): WorkerRecord | undefined {
  if (!published) return undefined;
  const jobs = Math.min(published.jobs, seen.jobs);
  if (jobs === 0) return undefined;
  const rated = Math.min(published.rated, seen.rated);
  const came_back = Math.min(published.came_back, seen.came_back);
  const capped = { jobs, rated, came_back };
  return rated >= MIN_RATED && published.average !== undefined ? { ...capped, average: published.average } : capped;
}
