import {
  canonicalJson,
  type EngagementId,
  EnvelopeKind,
  type JobProblem,
  type Payment,
  PROBLEM_PROTOCOL,
  type ProblemReason,
  ProblemState,
  Role,
} from "@gigsync/protocol";
import type { JobContext } from "../job/context.js";
import type { JobRecord } from "../job/store.js";
import { log } from "../log.js";
import { bothSigned } from "../payments/passbook.js";
import { contactsDue, hasEnded, ProblemBy, problemHolds } from "./rules.js";
import { cleanerFor, scrubJob, scrubNeed } from "./scrub.js";

/** What the owner says when reporting a problem: a reason from the list, and a few words if they like. */
export interface ProblemReport {
  reason: ProblemReason;
  text?: string;
}

export class ProblemError extends Error {}

const K = EnvelopeKind.enum;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** A problem may be reported on a job both signed whose contacts are still here, and only one at a time. */
export const canReport = (job: JobRecord, now: Date): boolean =>
  bothSigned(job) && !job.restored && !job.contacts_removed_at && !problemHolds(job.problem, now);

/**
 * The contact details of settled jobs, and the problems that hold them (ADR 0039 §3), on one phone. `sweep` runs on
 * every sync and is idempotent: a job is stamped when first seen ended, cleaned once due, and a cleaned job's later
 * words (a note after it settled) are cleaned again. Nothing here leaves the phone except the `problem` envelope.
 */
export class ContactKeeper {
  constructor(private readonly ctx: JobContext) {}

  /** Removes the contacts of every job now due; returns how many were removed this time. */
  async sweep(): Promise<number> {
    const now = this.ctx.clock.now();
    const payments = await this.ctx.payments.all();
    let removed = 0;
    for (const job of await this.ctx.store.jobs()) {
      const own = payments.filter((p) => p.engagement === job.engagement.id);
      const next = await this.settle(job, own, now);
      if (next.contacts_removed_at && !job.contacts_removed_at) removed += 1;
      if (!same(next, job)) await this.ctx.store.saveJob(next);
    }
    if (removed > 0) log.info("contacts removed from settled jobs", { jobs: removed });
    return removed;
  }

  /** The job as it should be stored now: stamped when it ended, and cleaned once due or already cleaned. */
  private async settle(job: JobRecord, payments: readonly Payment[], now: Date): Promise<JobRecord> {
    const stamped =
      hasEnded(job) && !job.ended_at && bothSigned(job) ? { ...job, ended_at: job.engagement.updated_at } : job;
    if (stamped.contacts_removed_at) return scrubJob(stamped, cleanerFor([]));
    if (!contactsDue({ job: stamped, payments, endedAt: stamped.ended_at }, now)) return stamped;
    const clean = cleanerFor([job.contact, this.ctx.contact]);
    await this.scrubNeedOf(job, clean);
    // The card goes, but not whom the job was with: a name alone reaches nobody, and the job, the passbook and an
    // introduction still need to say whom.
    const name = job.contact?.name ?? job.their_name;
    return {
      ...scrubJob(stamped, clean),
      contacts_removed_at: now.toISOString(),
      ...(name ? { their_name: name } : {}),
    };
  }

  /** On the household's phone the need its request came from holds the same words. */
  private async scrubNeedOf(job: JobRecord, clean: (text: string) => string): Promise<void> {
    if (job.engagement.role !== Role.enum.requester) return;
    const need = await this.ctx.store.need(job.engagement.group);
    if (need) await this.ctx.store.saveNeed(scrubNeed(need, clean));
  }

  /** The owner reports a problem: kept on this phone, and told to the other one when it understands it. */
  async report(id: EngagementId, report: ProblemReport): Promise<JobRecord> {
    const job = await this.job(id);
    const now = this.ctx.clock.now();
    if (!canReport(job, now)) throw new ProblemError("no problem can be reported on this job now");
    const told = await this.ctx.speaks(job.engagement.counterpart, PROBLEM_PROTOCOL);
    const text = report.text?.trim();
    const problem = {
      by: ProblemBy.me,
      reason: report.reason,
      lang: this.ctx.lang,
      opened_at: now.toISOString(),
      told,
    };
    const next: JobRecord = { ...job, problem: text ? { ...problem, text } : problem };
    await this.ctx.store.saveJob(next);
    if (!told) return next;
    const body: JobProblem = { state: ProblemState.enum.open, reason: report.reason, lang: this.ctx.lang };
    return this.ctx.send(next, K.problem, text ? { ...body, text } : body);
  }

  /** Either side marks the problem resolved: the contacts then follow the usual rules again. */
  async resolve(id: EngagementId): Promise<JobRecord> {
    const job = await this.job(id);
    if (!job.problem || job.problem.resolved_at) throw new ProblemError("no open problem on this job");
    const next = { ...job, problem: { ...job.problem, resolved_at: this.ctx.clock.now().toISOString() } };
    await this.ctx.store.saveJob(next);
    if (!(await this.ctx.speaks(job.engagement.counterpart, PROBLEM_PROTOCOL))) return next;
    return this.ctx.send(next, K.problem, { state: ProblemState.enum.resolved } satisfies JobProblem);
  }

  /** The other side reported or resolved a problem. One reported after the contacts went changes nothing. */
  async receive(job: JobRecord, body: JobProblem): Promise<void> {
    const now = this.ctx.clock.now().toISOString();
    if (body.state === ProblemState.enum.resolved) {
      if (job.problem && !job.problem.resolved_at)
        await this.ctx.store.saveJob({ ...job, problem: { ...job.problem, resolved_at: now } });
      return;
    }
    if (!bothSigned(job) || job.contacts_removed_at) {
      log.warn("problem ignored", { engagement: job.engagement.id, reason: "contacts already removed" });
      return;
    }
    const problem = { by: ProblemBy.them, reason: body.reason, lang: body.lang, opened_at: now, told: true };
    await this.ctx.store.saveJob({ ...job, problem: body.text ? { ...problem, text: body.text } : problem });
  }

  private async job(id: EngagementId): Promise<JobRecord> {
    const job = await this.ctx.store.job(id);
    if (!job) throw new ProblemError(`no job ${id}`);
    return job;
  }
}
