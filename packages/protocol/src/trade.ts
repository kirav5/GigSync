import { z } from "zod";

/** The trades GigSync lists. A worker offers one or more; a consumer asks for exactly one. */
export const Trade = z.enum([
  "electrician",
  "plumber",
  "maid",
  "carpenter",
  "ac_technician",
  "painter",
  "cook",
  "driver",
]);
export type Trade = z.infer<typeof Trade>;

/**
 * A job's kind of work (ADR 0047): one of the trades, or `other` for a skill a worker lists in their own words. A job
 * of `other` carries its `Skill`; it has no price drivers, scope buckets or estimate, and the generic questions.
 */
export const JobTrade = z.enum([...Trade.options, "other"]);
export type JobTrade = z.infer<typeof JobTrade>;

/** True for one of the trades, which have price questions and estimates; false for `other`. */
export const isTrade = (work: JobTrade): work is Trade => work !== JobTrade.enum.other;
