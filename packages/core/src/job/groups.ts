import {
  type EngagementId,
  EngagementStatus,
  type Payment,
  PaymentStatus,
  Role,
  TERMINAL_STATUSES,
} from "@gigsync/protocol";
import type { JobRecord, OwnerTask } from "./store.js";
import { isAfterDay, isOnDay, recurs } from "./when.js";

const S = EngagementStatus.enum;

/** Signed and not over: the work is ahead, under way, handed over, or being redone. */
const ACTIVE: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered, S.revision]);

/** Every job on one phone, filed once each, the way Activity shows them. Each list is newest first. */
export interface JobGroups {
  /** An owner task is open on the job: approve, answer, sign, or say whether the money came. */
  decide: JobRecord[];
  /** Signed work on the day being shown, every day, or monthly work that has started. */
  today: JobRecord[];
  /** Signed work on a later day. */
  upcoming: JobRecord[];
  /** Signed work with no day: agreed before the When chips, or the other phone sent none. */
  other: JobRecord[];
  /** The agents are still asking, quoting or waiting for a signature. */
  talking: JobRecord[];
  /** Over, or a delivered one-off job whose money is confirmed. */
  earlier: JobRecord[];
}

/** What `groupJobs` files: the phone's jobs, its open owner tasks and payments, and its day ("YYYY-MM-DD"). */
export interface JobsOnPhone {
  jobs: readonly JobRecord[];
  tasks: readonly OwnerTask[];
  payments: readonly Payment[];
  day: string;
}

/**
 * Files each job once. A waiting decision wins over everything, so nothing the owner must answer is ever hidden.
 * `day` is the phone's own "YYYY-MM-DD".
 */
export function groupJobs({ jobs, tasks, payments, day }: JobsOnPhone): JobGroups {
  const open = new Set<EngagementId>(tasks.map((k) => k.engagement));
  const paidFor = new Set<EngagementId>(
    // An advance is not the job paid: the worker still has the rest to ask for here (ADR 0054).
    payments.filter((p) => p.status === PaymentStatus.enum.confirmed && !p.advance).map((p) => p.engagement),
  );
  const groups: JobGroups = { decide: [], today: [], upcoming: [], other: [], talking: [], earlier: [] };
  const newest = [...jobs].sort((a, b) => b.engagement.created_at.localeCompare(a.engagement.created_at));
  for (const job of newest) {
    const id = job.engagement.id;
    shelf(groups, job, open.has(id), paidFor.has(id), day).push(job);
  }
  return groups;
}

function shelf(groups: JobGroups, job: JobRecord, decide: boolean, paid: boolean, day: string): JobRecord[] {
  const status = job.engagement.status;
  if (decide) return groups.decide;
  if (TERMINAL_STATUSES.has(status) || (paid && settled(job))) return groups.earlier;
  if (!ACTIVE.has(status)) return groups.talking;
  if (isOnDay(job.request, day)) return groups.today;
  if (isAfterDay(job.request, day)) return groups.upcoming;
  return groups.other;
}

/**
 * A paid one-off job has nothing left to do once the work is handed over. Paid before that (cash at the door), the
 * work is still ahead, under way or being redone, and its On my way and Mark done stay in view. A consumer's review
 * of delivered work keeps it in view too, until the review closes it. Monthly work recurs, so it never settles: it
 * leaves Agreed only once the arrangement ends (closed or cancelled).
 */
function settled(job: JobRecord): boolean {
  if (!workDone(job)) return false;
  return !(job.engagement.role === Role.enum.requester && !job.review);
}

/** One-off work handed over: done, whatever is left to say about it (a household's review). */
export const workDone = (job: JobRecord): boolean => !recurs(job.request) && job.engagement.status === S.delivered;
