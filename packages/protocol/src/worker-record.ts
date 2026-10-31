import { z } from "zod";

/**
 * A worker's record on their card (ADR 0036, computed per ADR 0038): stored jobs the worker finished (attested by both
 * sides, or one-sided when only the worker's side reached the server), how many households rated them and the average
 * of their stars. The server computes it from stored job records and serves it on every card unless the worker hid it.
 * Nothing ever sorts, filters or ranks workers by it.
 */

/** Stars a household gives in a review, lowest and highest. */
export const MIN_STARS = 1;
export const MAX_STARS = 5;
/** The average shows only once at least this many households rated the worker. */
export const MIN_RATED = 3;
/** Averages are shown to one decimal: tenths of a star. */
export const AVERAGE_SCALE = 10;
/** No honest count comes near this; it bounds the schema. */
export const MAX_RECORD_COUNT = 1_000_000;

/** An average of stars to one decimal, as cards show it. */
export const roundAverage = (stars: number): number => Math.round(stars * AVERAGE_SCALE) / AVERAGE_SCALE;

const count = z.number().int().nonnegative().max(MAX_RECORD_COUNT);

/**
 * The record as the server serves it; `average` is present only when `rated` is at least MIN_RATED.
 */
export const WorkerRecord = z.object({
  /** Stored jobs done: attested by both sides, or one-sided (only the worker's side reached the server). */
  jobs: count,
  /** Stored jobs the household rated, one rating per job. */
  rated: count,
  /** The average of those stars, to one decimal. */
  average: z.number().min(MIN_STARS).max(MAX_STARS).optional(),
});
export type WorkerRecord = z.infer<typeof WorkerRecord>;
