import { z } from "zod";
import { Arrangement, ArrangementRates } from "./arrangement.js";
import { UserId } from "./ids.js";
import { Paise } from "./payment.js";
import { Place } from "./place.js";
import { distinctSkills, MAX_SKILLS, Skill, SkillKey } from "./skill.js";
import { Trade } from "./trade.js";
import { WorkerRecord } from "./worker-record.js";

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

/**
 * `PUT /v1/board/profile`: the worker's public card. Every card the server serves (search results, a scanned QR, a
 * worker's card by id) has the same shape, with `record` computed by the server from stored job records (ADR 0038)
 * unless the worker hid it, and no `show_record`. A `record` sent with the card is ignored.
 */
const CardFields = z.object({
  display_name: z.string().min(1).max(60),
  trades: z
    .array(Trade)
    .max(MAX_TRADES)
    .refine((t) => new Set(t).size === t.length, "no repeated trades"),
  /** ADR 0047: work outside the trades, in the worker's own words; absent on older cards. */
  skills: z.array(Skill).max(MAX_SKILLS).refine(distinctSkills, "no repeated skills").optional(),
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
  /** Served only: the server's record of the worker's stored jobs; left out when hidden or no job is stored. */
  record: WorkerRecord.optional(),
  /** ADR 0046: the arrangements a maid or driver takes, with the usual rate for each; absent means monthly only. */
  arrangements: ArrangementRates.optional(),
  /** Show my record: false hides it from the card entirely (never single ratings). Absent means unchanged (new: shown). */
  show_record: z.boolean().optional(),
});

/** A card lists at least one trade or skill, and no more than `MAX_TRADES` of both together. */
const someWork = (c: { trades: readonly unknown[]; skills?: readonly unknown[] | undefined }): boolean => {
  const all = c.trades.length + (c.skills?.length ?? 0);
  return all >= 1 && all <= MAX_TRADES;
};
const SOME_WORK = "one to five trades and skills";

export const BoardProfile = CardFields.refine(someWork, SOME_WORK);
export type BoardProfile = z.infer<typeof BoardProfile>;
/** A card as a phone sends it. */
export type BoardProfileInput = z.input<typeof BoardProfile>;

/**
 * `GET /v1/board/profile`: the caller's own card for a new phone's refill (ADR 0037 §4), with their switch and their
 * record even while it is hidden from others.
 */
export const MyBoardProfile = CardFields.extend({ show_record: z.boolean() }).refine(someWork, SOME_WORK);
export type MyBoardProfile = z.infer<typeof MyBoardProfile>;

/** `GET /v1/board/workers?...`: query-string values arrive as text, hence the coercion. */
export const BoardQuery = z
  .object({
    /** One of the trades, or else `skill`: a key from `GET /v1/board/skills` (ADR 0047), never the household's words. */
    trade: Trade.optional(),
    skill: SkillKey.optional(),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius_km: z.coerce.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM),
    max_rate_paise: z.coerce.number().int().positive().optional(),
    /** ADR 0046: only workers who take this arrangement; a card without arrangements takes monthly work only. */
    arrangement: Arrangement.optional(),
    limit: z.coerce.number().int().min(1).max(MAX_RESULTS).default(DEFAULT_RESULTS),
  })
  .refine((q) => (q.trade === undefined) !== (q.skill === undefined), "a trade or a skill");
export type BoardQuery = z.infer<typeof BoardQuery>;
export type BoardQueryInput = z.input<typeof BoardQuery>;

/** One search result: the card plus who it is and how far, nearest first. */
export const BoardWorker = CardFields.extend({ user: UserId, distance_km: z.number().nonnegative() });
export type BoardWorker = z.infer<typeof BoardWorker>;

export const BoardResult = z.object({ workers: z.array(BoardWorker) });
export type BoardResult = z.infer<typeof BoardResult>;
