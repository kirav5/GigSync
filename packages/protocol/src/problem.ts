import { z } from "zod";
import { DEFAULT_LANG, Lang } from "./lang.js";

/**
 * "Report a problem" on a signed job (ADR 0039 §3): either side may say something went wrong before the contact
 * details are deleted, and both phones keep them until either side marks it resolved, at most `PROBLEM_HOLD_DAYS`.
 * It travels beside the job as `problem`, which never moves the engagement.
 */

/**
 * The device capability number that understands `problem`. A phone below it would drop the envelope, so it is sent
 * only when every device of the other side reports this number. Includes WORK_OFFER_PROTOCOL (6) and everything before.
 */
export const PROBLEM_PROTOCOL = 7;

/** A reported problem holds the contacts at most this long, resolved or not. */
export const PROBLEM_HOLD_DAYS = 30;
/** The longest note a problem may carry: a few words, not a statement. */
export const PROBLEM_NOTE_MAX = 300;

/** The short reasons offered; each phone shows them in its owner's language. */
export const ProblemReason = z.enum(["not_paid", "work_unfinished", "damage", "behaviour", "other"]);
export type ProblemReason = z.infer<typeof ProblemReason>;

/** A problem is reported (`open`) or settled (`resolved`), by either side. */
export const ProblemState = z.enum(["open", "resolved"]);
export type ProblemState = z.infer<typeof ProblemState>;

/** `problem`: the reason and optional words when reported; only the state when resolved. */
export const JobProblem = z.discriminatedUnion("state", [
  z.object({
    state: z.literal(ProblemState.enum.open),
    reason: ProblemReason,
    text: z.string().max(PROBLEM_NOTE_MAX).optional(),
    lang: Lang.default(DEFAULT_LANG),
  }),
  z.object({ state: z.literal(ProblemState.enum.resolved) }),
]);
export type JobProblem = z.infer<typeof JobProblem>;
