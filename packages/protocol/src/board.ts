import { z } from "zod";
import { UserId } from "./ids.js";
import { Place, Trade } from "./job.js";
import { Paise } from "./payment.js";

/**
 * The job board: how a consumer's agent finds workers (LLD §7.5). A worker publishes a card with their trades, an
 * approximate area and a starting rate; the server stores the area rounded to about a kilometre. Search is by trade
 * and distance. Contact details are never on the board: they are released only after both sides sign a job.
 */

export const DEFAULT_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 50;
export const DEFAULT_RESULTS = 10;
export const MAX_RESULTS = 50;
export const MAX_TRADES = 5;
const MAX_LANGUAGES = 5;

/** `PUT /v1/board/profile`: the worker's public card. */
export const BoardProfile = z.object({
  display_name: z.string().min(1).max(60),
  trades: z
    .array(Trade)
    .min(1)
    .max(MAX_TRADES)
    .refine((t) => new Set(t).size === t.length, "no repeated trades"),
  area: Place,
  /** A neighbourhood name people recognise, e.g. "Indiranagar". */
  area_name: z.string().min(1).max(60),
  /** The worker's usual rate for a visit; their private minimum stays on their phone. */
  rate_paise: Paise,
  languages: z
    .array(z.string().regex(/^[a-z]{2}$/, "ISO 639-1"))
    .max(MAX_LANGUAGES)
    .default([]),
  about: z.string().max(300).default(""),
});
export type BoardProfile = z.infer<typeof BoardProfile>;

/** `GET /v1/board/workers?...`: query-string values arrive as text, hence the coercion. */
export const BoardQuery = z.object({
  trade: Trade,
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM),
  max_rate_paise: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_RESULTS).default(DEFAULT_RESULTS),
});
export type BoardQuery = z.infer<typeof BoardQuery>;
export type BoardQueryInput = z.input<typeof BoardQuery>;

/** One search result: the card plus who it is and how far, nearest first. */
export const BoardWorker = BoardProfile.extend({ user: UserId, distance_km: z.number().nonnegative() });
export type BoardWorker = z.infer<typeof BoardWorker>;

export const BoardResult = z.object({ workers: z.array(BoardWorker) });
export type BoardResult = z.infer<typeof BoardResult>;
