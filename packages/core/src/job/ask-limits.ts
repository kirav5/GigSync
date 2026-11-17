import { EngagementStatus, MAX_REQUESTS_PER_DAY, Role } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import type { JobRecord } from "./store.js";

/**
 * How much one household may ask at once (agreed 2026-11-18): at most `MAX_OPEN_REQUESTS` needs whose assistants are
 * still talking, and at most `MAX_REQUESTS_PER_DAY` workers asked in a day. The phone says so before it asks; the
 * server refuses a day's requests past the cap (routes/mail.ts), since the grouping of requests into needs is sealed.
 */

const S = EngagementStatus.enum;

/** Needs a household has going at once: each may ask up to three workers. */
export const MAX_OPEN_REQUESTS = 3;
const DAY_MS = 86_400_000;

/** Still being talked over: asked, answered, bargained or waiting for a signature. Signed or over, it no longer counts. */
const TALKING: ReadonlySet<EngagementStatus> = new Set([
  S.draft,
  S.sent,
  S.clarifying,
  S.responded,
  S.negotiating,
  S.confirming,
]);

const asked = (jobs: readonly JobRecord[]) => jobs.filter((j) => j.engagement.role === Role.enum.requester);

/** The household's needs still being talked over, one however many workers it asked. */
export const openRequests = (jobs: readonly JobRecord[]): number =>
  new Set(
    asked(jobs)
      .filter((j) => TALKING.has(j.engagement.status))
      .map((j) => j.engagement.group),
  ).size;

/** Workers this household asked in the day before `now`. */
export const requestsToday = (jobs: readonly JobRecord[], now: Date): number =>
  asked(jobs).filter((j) => now.getTime() - Date.parse(j.engagement.created_at) < DAY_MS).length;

/** Why a new need asking `workers` more may not go, as the chat says it; undefined when it may. */
export function askRefusal(jobs: readonly JobRecord[], workers: number, now: Date): MessageKey | undefined {
  if (openRequests(jobs) >= MAX_OPEN_REQUESTS) return "need.limit_open";
  if (requestsToday(jobs, now) + workers > MAX_REQUESTS_PER_DAY) return "need.limit_day";
  return undefined;
}
