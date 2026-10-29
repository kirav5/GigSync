import { isAfterDay, isMonthly, isOnDay, type JobRecord, localDay, type OwnerTask } from "@gigsync/core";
import {
  CancelReason,
  type EngagementId,
  EngagementStatus,
  type Payment,
  PaymentStatus,
  Role,
  TERMINAL_STATUSES,
} from "@gigsync/protocol";

const S = EngagementStatus.enum;

/** Signed and not over: the work is ahead, under way, handed over, or being redone. */
const ACTIVE: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered, S.revision]);

/** A date-only ISO string read as midday on this phone, so no time zone or clock change moves it to another day. */
const LOCAL_NOON = "T12:00:00";

/** A worker's own refusals: their agent's (not their trade or area) and their own; a household withdrawing is not. */
const DECLINED_BY_ME: ReadonlySet<CancelReason> = new Set([
  CancelReason.enum.no_match,
  CancelReason.enum.declined_by_owner,
]);
/** A colleague suggestion waits under To decide for a day after the decline (worker) or the suggestion (household). */
const REFER_WINDOW_MS = 86_400_000;

/** Every job on one phone, filed the way Today and My jobs show them. Each list is newest first. */
interface JobGroups {
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

/** Today's date on this phone ("YYYY-MM-DD"), in the phone's own time zone. */
export function phoneDay(now: Date): string {
  return localDay(now, -now.getTimezoneOffset());
}

/** A job's day ("YYYY-MM-DD") as a date to show with the owner's `date()`. */
export function dayDate(day: string): Date {
  return new Date(day + LOCAL_NOON);
}

/**
 * Files each job once. A waiting decision wins over everything, so nothing the owner must answer is ever folded away.
 * `day` is the phone's "YYYY-MM-DD" (`phoneDay`).
 */
export function groupJobs({
  jobs,
  tasks,
  payments,
  day,
  referrals = new Set(),
}: {
  jobs: readonly JobRecord[];
  tasks: readonly OwnerTask[];
  payments: readonly Payment[];
  day: string;
  /** Jobs with a colleague suggestion to answer (`referralsOpen`), filed under To decide too. */
  referrals?: ReadonlySet<EngagementId>;
}): JobGroups {
  const open = new Set<EngagementId>([...tasks.map((k) => k.engagement), ...referrals]);
  const paidFor = new Set<EngagementId>(
    payments.filter((p) => p.status === PaymentStatus.enum.confirmed).map((p) => p.engagement),
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
 * of delivered work keeps it in view too, under Your jobs until the review closes it. Monthly work recurs, so it never
 * settles.
 */
function settled(job: JobRecord): boolean {
  if (isMonthly(job.request.trade)) return false;
  const e = job.engagement;
  if (e.status !== S.delivered) return false;
  return !(e.role === Role.enum.requester && !job.review);
}

/** A request this worker's phone turned down, so it may suggest a colleague instead (round2-spec §3.3 B). */
export function declinedByMe(job: JobRecord): boolean {
  const e = job.engagement;
  const reason = job.cancel?.reason;
  return e.role === Role.enum.provider && e.status === S.declined && reason !== undefined && DECLINED_BY_ME.has(reason);
}

/**
 * The jobs with a colleague suggestion still to answer, from the last day: on a worker's phone that has a colleague to
 * suggest, a request it declined and has not passed on; on a household's, a colleague the worker suggested.
 */
export function referralsOpen({
  jobs,
  answered,
  canSuggest,
  now,
}: {
  jobs: readonly JobRecord[];
  /** Suggestions the owner already answered, by job. */
  answered: ReadonlyMap<EngagementId, unknown>;
  canSuggest: boolean;
  now: Date;
}): Set<EngagementId> {
  const recent = (at: string) => now.getTime() - Date.parse(at) < REFER_WINDOW_MS;
  const open = new Set<EngagementId>();
  for (const job of jobs) {
    if (answered.has(job.engagement.id)) continue;
    const mine = canSuggest && declinedByMe(job) && !job.referred && recent(job.engagement.updated_at);
    const theirs = job.referral !== undefined && recent(job.referral.at);
    if (mine || theirs) open.add(job.engagement.id);
  }
  return open;
}
