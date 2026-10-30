import { z } from "zod";

/**
 * A worker's record on their card (ADR 0036): jobs both sides signed, how many households rated them and the average of
 * their stars, and how many households hired them again. The worker's phone publishes it with the board card; the
 * server caps each count at what it saw delivered (envelope headers only, never content) and serves the capped record.
 * Nothing ever sorts, filters or ranks workers by it.
 */

/** Stars a household gives in a review, lowest and highest. */
export const MIN_STARS = 1;
export const MAX_STARS = 5;
/** The average shows only once at least this many households rated the worker. */
export const MIN_RATED = 3;
/** Averages are shown to one decimal: tenths of a star. */
export const AVERAGE_SCALE = 10;
/** No honest count comes near this; it only bounds what a caller may send. */
export const MAX_RECORD_COUNT = 1_000_000;

/** An average of stars to one decimal, as cards show it. */
export const roundAverage = (stars: number): number => Math.round(stars * AVERAGE_SCALE) / AVERAGE_SCALE;

const count = z.number().int().nonnegative().max(MAX_RECORD_COUNT);

/**
 * The three numbers. As the worker publishes them they come from their phone's own record; as a card is served each
 * count is capped at the server's, and `average` is present only when `rated` is at least MIN_RATED.
 */
export const WorkerRecord = z.object({
  /** Jobs both sides signed (two `agree`s on one engagement). */
  jobs: count,
  /** Households that rated a signed job, one per household per job. */
  rated: count,
  /** The average of those stars, to one decimal. */
  average: z.number().min(MIN_STARS).max(MAX_STARS).optional(),
  /** Households that signed two or more jobs with the worker. */
  came_back: count,
});
export type WorkerRecord = z.infer<typeof WorkerRecord>;
