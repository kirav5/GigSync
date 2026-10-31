import { MAX_LANDING_REQUESTS, type MentorProfile } from "@gigsync/protocol";
import type { NewcomerPrefs } from "../mentor/types.js";

/**
 * "Find someone who knows the city", asked in Talk: the women-only question once, if she has not answered it, then
 * the matched mentors as chat cards, at most three, as the server sent them (most jobs first; no model ranks anyone).
 * Asking one shows the safety words first, once, then asks the week she arrives, then sends the request.
 */

/** What to do on "Find someone who knows the city". */
export const FindStep = { woman: "woman", search: "search" } as const;
export type FindStep = (typeof FindStep)[keyof typeof FindStep];

/** What to do on a mentor's Ask. */
export const AskStep = { safety: "safety", arrival: "arrival" } as const;
export type AskStep = (typeof AskStep)[keyof typeof AskStep];

/** A chat shows at most this many mentors, as many as one request may go to. */
export const MENTORS_SHOWN = MAX_LANDING_REQUESTS;

/** How soon she may say she arrives, in weeks from now: this week, next week, the week after. */
export const ARRIVAL_WEEKS = [0, 1, 2] as const;
export type ArrivalWeeks = (typeof ARRIVAL_WEEKS)[number];

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** Length of "YYYY-MM-DD" at the start of an ISO time. */
const DAY_LENGTH = 10;

export const findStep = (prefs: NewcomerPrefs): FindStep =>
  prefs.woman === undefined ? FindStep.woman : FindStep.search;

export const askStep = (prefs: NewcomerPrefs): AskStep => (prefs.safety_seen ? AskStep.arrival : AskStep.safety);

/** The mentors a chat shows, in the server's order. */
export const shownMentors = (found: readonly MentorProfile[]): MentorProfile[] => found.slice(0, MENTORS_SHOWN);

/** A day in the week she arrives, `YYYY-MM-DD`: any day of it will do, the request names its Monday. */
export function arrivalDay(now: Date, weeks: number): string {
  return new Date(now.getTime() + weeks * DAYS_PER_WEEK * MS_PER_DAY).toISOString().slice(0, DAY_LENGTH);
}

/** True for a number of weeks the chat offers; a chip read back from an older app may hold another. */
export const isArrivalWeeks = (weeks: unknown): weeks is ArrivalWeeks => ARRIVAL_WEEKS.some((w) => w === weeks);
