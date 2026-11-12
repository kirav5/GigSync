import { bothSigned, type JobRecord, reachedAt } from "@gigsync/core";
import { EngagementStatus, Role } from "@gigsync/protocol";

/** One job whose contact cards went both ways on this phone: what of the owner's went to whom, when, and until when. */
export interface SharedEntry {
  job: JobRecord;
  /** When both signed, which is when the owner's card went to the other side; unknown for a job from before stamps. */
  at: string | undefined;
  /** When this phone removed their details, the job settled (ADR 0039 §3); undefined while both phones hold them. */
  removed: string | undefined;
  /** The owner was the household: their card carried the job's address and door pin with the number. */
  address: boolean;
}

/**
 * "What your agent shared" (design P3), derived from the jobs on this phone, newest first: the owner's contact card goes
 * to the other side only once both have signed (core job/deal.ts), and is removed once the job is settled. A job
 * restored from the record is left out: its cards went from another phone, which this one cannot speak for.
 */
export function sharedLog(jobs: readonly JobRecord[]): SharedEntry[] {
  return jobs
    .filter((job) => bothSigned(job) && !job.restored)
    .map((job) => ({
      job,
      at: reachedAt(job, EngagementStatus.enum.agreed),
      removed: job.contacts_removed_at,
      address: job.engagement.role === Role.enum.requester,
    }))
    .sort((a, b) => Date.parse(b.at ?? b.job.engagement.created_at) - Date.parse(a.at ?? a.job.engagement.created_at));
}
