import { z } from "zod";
import { Arrangement, ArrangementRates } from "./arrangement.js";
import { UserId } from "./ids.js";
import { Paise } from "./payment.js";
import { Place } from "./place.js";
import { distinctSkills, MAX_SKILLS, Skill, SkillKey, skillKey } from "./skill.js";
import { StartHour, TimeWindow } from "./terms.js";
import { Trade } from "./trade.js";
import { WorkCategory } from "./work-category.js";
import { SearchDay, WorkHours } from "./work-hours.js";
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
 * ADR 0062: the usual rate for one kind of work on the card when it differs from the card's own rate, which is the
 * rate for the card's first kind. A trade by its value, a skill by its key. The lowest rate stays on the phone.
 */
export const WorkRate = z.union([
  z.object({ trade: Trade, rate_paise: Paise }).strict(),
  z.object({ skill: SkillKey, rate_paise: Paise }).strict(),
]);
export type WorkRate = z.infer<typeof WorkRate>;

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
  /**
   * The worker's usual rate for a visit of their first kind of work; their private minimum stays on their phone. In a
   * search result it is the rate for the work searched (ADR 0062).
   */
  rate_paise: Paise,
  /** ADR 0062: kinds of work with a rate of their own; every other kind is at `rate_paise`. */
  work_rates: z.array(WorkRate).max(MAX_TRADES).optional(),
  languages: z
    .array(z.string().regex(/^[a-z]{2}$/, "ISO 639-1"))
    .max(MAX_LANGUAGES)
    .default([]),
  about: z.string().max(300).default(""),
  /** Served only: the server's record of the worker's stored jobs; left out when hidden or no job is stored. */
  record: WorkerRecord.optional(),
  /** ADR 0046: the arrangements a maid or driver takes, with the usual rate for each; absent means monthly only. */
  arrangements: ArrangementRates.optional(),
  /** ADR 0050: the days and parts of the day the worker works; absent means any day, any time. */
  work_hours: WorkHours.optional(),
  /** Show my record: false hides it from the card entirely (never single ratings). Absent means unchanged (new: shown). */
  show_record: z.boolean().optional(),
});

/** A card lists at least one trade or skill, and no more than `MAX_TRADES` of both together. */
const someWork = (c: { trades: readonly unknown[]; skills?: readonly unknown[] | undefined }): boolean => {
  const all = c.trades.length + (c.skills?.length ?? 0);
  return all >= 1 && all <= MAX_TRADES;
};
const SOME_WORK = "one to five trades and skills";

/** Every rate of its own is for a trade or skill on the card, and each at most once. */
const ratesOnCard = (c: {
  trades: readonly Trade[];
  skills?: readonly Skill[] | undefined;
  work_rates?: readonly WorkRate[] | undefined;
}): boolean => {
  const keys = new Set((c.skills ?? []).map((s) => skillKey(s.text)));
  const named = (c.work_rates ?? []).map((r) => ("trade" in r ? `t:${r.trade}` : `s:${r.skill}`));
  const known = (c.work_rates ?? []).every((r) => ("trade" in r ? c.trades.includes(r.trade) : keys.has(r.skill)));
  return known && new Set(named).size === named.length;
};
const RATES_ON_CARD = "a rate of its own for each kind on the card, at most once";

export const BoardProfile = CardFields.refine(someWork, SOME_WORK).refine(ratesOnCard, RATES_ON_CARD);
export type BoardProfile = z.infer<typeof BoardProfile>;
/** A card as a phone sends it. */
export type BoardProfileInput = z.input<typeof BoardProfile>;

/**
 * `GET /v1/board/profile`: the caller's own card for a new phone's refill (ADR 0037 §4), with their switch and their
 * record even while it is hidden from others.
 */
export const MyBoardProfile = CardFields.extend({ show_record: z.boolean() })
  .refine(someWork, SOME_WORK)
  .refine(ratesOnCard, RATES_ON_CARD);
export type MyBoardProfile = z.infer<typeof MyBoardProfile>;

/** `GET /v1/board/workers?...`: query-string values arrive as text, hence the coercion. */
export const BoardQuery = z
  .object({
    /** One of the trades, a kind of work (ADR 0059), or a key from `GET /v1/board/skills`: never the household's words. */
    trade: Trade.optional(),
    category: WorkCategory.optional(),
    skill: SkillKey.optional(),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius_km: z.coerce.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM),
    max_rate_paise: z.coerce.number().int().positive().optional(),
    /**
     * ADR 0046: only workers who take this arrangement. A trade's card without arrangements takes monthly work only;
     * a skill's or a kind of work's takes any (ADR 0047).
     */
    arrangement: Arrangement.optional(),
    /**
     * ADR 0050: the household's day and part of the day. Workers whose hours leave it out, or who already have a
     * signed job then on GigSync's record, are not listed. Either may be absent: any day, or any time that day.
     */
    day: SearchDay.optional(),
    window: TimeWindow.optional(),
    /** ADR 0053 §1: the hour the work starts. With it, workers' own hours and signed jobs are matched by the hour. */
    hour: z.coerce.number().pipe(StartHour).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_RESULTS).default(DEFAULT_RESULTS),
  })
  .refine((q) => [q.trade, q.category, q.skill].filter(Boolean).length === 1, "a trade, a category or a skill");
export type BoardQuery = z.infer<typeof BoardQuery>;
export type BoardQueryInput = z.input<typeof BoardQuery>;

/** One search result: the card plus who it is and how far, nearest first. */
export const BoardWorker = CardFields.extend({ user: UserId, distance_km: z.number().nonnegative() });
export type BoardWorker = z.infer<typeof BoardWorker>;

export const BoardResult = z.object({ workers: z.array(BoardWorker) });
export type BoardResult = z.infer<typeof BoardResult>;
