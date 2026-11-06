import { z } from "zod";
import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM } from "./board.js";
import { Paise } from "./payment.js";
import { SkillKey } from "./skill.js";

/**
 * What workers near a household list for a skill (ADR 0057): work with no rate card or GigSync jobs behind it still gets
 * a range, from what workers say they charge, never from a model. Fewer than `MIN_LISTED_RATES` workers give no range,
 * so nobody's own rate can be read off it.
 */

export const MIN_LISTED_RATES = 3;

/** `GET /v1/board/rates`. */
export const ListedRatesQuery = z.object({
  skill: SkillKey,
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM),
});
export type ListedRatesQuery = z.infer<typeof ListedRatesQuery>;
export type ListedRatesQueryInput = z.input<typeof ListedRatesQuery>;

/** The middle half of the rates listed nearby, rounded; no range under `MIN_LISTED_RATES` workers. */
export const ListedRates = z.object({
  workers: z.number().int().nonnegative(),
  low_paise: Paise.optional(),
  high_paise: Paise.optional(),
});
export type ListedRates = z.infer<typeof ListedRates>;
