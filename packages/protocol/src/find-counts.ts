import { z } from "zod";

/**
 * How people use Find, as bare counts per day (ADR 0060): whether they type or tap, and how often the work has to be
 * corrected. No user, no words and no work: only that it happened, so the choice about Find's first screen rests on
 * something measured.
 */
export const FindEvent = z.enum(["typed", "tapped", "not_this", "changed"]);
export type FindEvent = z.infer<typeof FindEvent>;

/** `POST /v1/find/count`. */
export const FindCount = z.object({ event: FindEvent });
export type FindCount = z.infer<typeof FindCount>;

export const MAX_FIND_COUNT_DAYS = 90;

/** `GET /v1/admin/analytics/find`: the last `days` days. */
export const FindCountsQuery = z.object({ days: z.coerce.number().int().min(1).max(MAX_FIND_COUNT_DAYS).default(30) });
export type FindCountsQuery = z.infer<typeof FindCountsQuery>;

export const FindCountRow = z.object({ day: z.string(), event: FindEvent, count: z.number().int().nonnegative() });
export type FindCountRow = z.infer<typeof FindCountRow>;

export const FindCounts = z.object({ rows: z.array(FindCountRow) });
export type FindCounts = z.infer<typeof FindCounts>;
