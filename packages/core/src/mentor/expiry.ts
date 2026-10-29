import { MENTOR_LINK_TTL_MS } from "@gigsync/protocol";

const MS_PER_DAY = 86_400_000;

/** When a mentor link opened or renewed at `from` closes (30 days on, round4-spec §2a), as ISO. */
export function mentorExpiry(from: Date): string {
  return new Date(from.getTime() + MENTOR_LINK_TTL_MS).toISOString();
}

/** A link with no end date never expires (a colleague met in person); a mentor link does at `expires_at`. */
export function isExpired(link: { expires_at?: string | undefined }, now: Date): boolean {
  return link.expires_at !== undefined && Date.parse(link.expires_at) <= now.getTime();
}

/** Whole days left before `expires_at`, rounded up so the last day still reads as 1; 0 once it has passed. */
export function daysLeft(expires_at: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(expires_at) - now.getTime()) / MS_PER_DAY));
}

/**
 * The later of the end this phone has and the one a renewal names, capped at a full term from now: a renewal from
 * the other phone can move the end forward, never back, and never beyond 30 days whatever their clock says.
 */
export function renewedExpiry(current: string | undefined, proposed: string, now: Date): string {
  const cap = now.getTime() + MENTOR_LINK_TTL_MS;
  const wanted = Math.min(Date.parse(proposed) || 0, cap);
  const kept = current ? Date.parse(current) : 0;
  return new Date(Math.max(wanted, kept)).toISOString();
}
