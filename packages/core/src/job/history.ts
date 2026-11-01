import type { EngagementStatus, Note } from "@gigsync/protocol";
import type { JobRecord } from "./store.js";

/**
 * When a job reached each status, as this phone saw it: its own moves when it made them, the other side's when they
 * arrived, and a restored job's from the record. The progress line on both apps reads it (progress.ts).
 */

/** One status and the moment this phone saw the job reach it. */
export interface StatusStamp {
  status: EngagementStatus;
  at: string;
}

/** A note as this phone keeps it: when it was sent or arrived, and whether this phone sent it. */
export type KeptNote = Note & { at?: string; mine?: boolean };

/** The job with its current status stamped, unless the last stamp already says it. */
export function stamped(r: JobRecord, at: string): JobRecord {
  const history = r.history ?? [];
  if (history.at(-1)?.status === r.engagement.status) return r;
  return { ...r, history: [...history, { status: r.engagement.status, at }] };
}

/** The job with one more note, stamped with its time. */
export const withNote = (r: JobRecord, note: Note, at: string, mine = false): JobRecord => ({
  ...r,
  notes: [...(r.notes ?? []), { ...note, at, ...(mine ? { mine } : {}) }],
});

/** When the job first reached `status`, if this phone saw it. */
export const reachedAt = (r: JobRecord, status: EngagementStatus): string | undefined =>
  r.history?.find((s) => s.status === status)?.at;
