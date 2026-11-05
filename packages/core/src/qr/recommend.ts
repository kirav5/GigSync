import {
  type EngagementId,
  EngagementStatus,
  EnvelopeKind,
  type QrCode,
  RECOMMEND_PROTOCOL,
  Role,
} from "@gigsync/protocol";
import { isArrangement } from "../contacts/rules.js";
import type { JobContext } from "../job/context.js";
import type { JobRecord } from "../job/store.js";
import { log } from "../log.js";
import { MentorStore } from "../mentor/store.js";
import { bothSigned, FINISHED_WORK } from "../payments/passbook.js";
import { QrError, QrProblem, qrProblemOf } from "./errors.js";
import type { QrApi } from "./types.js";

/**
 * A household may recommend the worker on a job both signed: once the work is finished, or while recurring work goes
 * on, since that is who a household knows best. Never on a cancelled job.
 */
export function canRecommend(job: JobRecord): boolean {
  const { role, status } = job.engagement;
  if (role !== Role.enum.requester || status === EngagementStatus.enum.cancelled || !bothSigned(job)) return false;
  return FINISHED_WORK.has(status) || isArrangement(job);
}

/** The jobs whose household recommended this worker, as the worker has not read yet; newest first. */
export const recommendedJobs = (jobs: readonly JobRecord[]): JobRecord[] =>
  jobs
    .filter((j) => j.engagement.role === Role.enum.provider && j.recommended_at !== undefined)
    .sort((a, b) => (b.recommended_at ?? "").localeCompare(a.recommended_at ?? ""));

/**
 * A household passing on a worker it hired, through its own contacts (ADR 0055). `code` gets the worker's live QR code
 * for the link; the phone's own apps carry it, so whom it reached stays with the owner. `tell` then tells the worker,
 * once per job. Nothing here is asked of the worker: they can still decline any request that comes of it.
 */
export class Recommendations {
  private readonly blocks: MentorStore;

  constructor(
    private readonly ctx: JobContext,
    private readonly api?: QrApi,
  ) {
    this.blocks = new MentorStore(ctx.storage);
  }

  // ── Household ───────────────────────────────────────────────────────────────────────────────────────────────────
  /** The live code of the worker on this job. Throws QrError when they may not be recommended. */
  async code(id: EngagementId): Promise<QrCode> {
    if (!this.api) throw new QrError(QrProblem.no_server);
    const job = await this.job(id);
    if (!canRecommend(job)) throw new QrError(QrProblem.no_job_record);
    const { counterpart } = job.engagement;
    if (await this.blocks.isBlocked(counterpart)) throw new QrError(QrProblem.blocked);
    try {
      return (await this.api.recommendWorker(counterpart)).code;
    } catch (err) {
      throw qrProblemOf(err);
    }
  }

  /**
   * The link went out: tells the worker, the first time from this job, if every one of their phones understands it.
   * True when the worker has been told.
   */
  async tell(id: EngagementId): Promise<boolean> {
    const job = await this.job(id);
    if (job.recommended_at) return true;
    if (!(await this.ctx.speaks(job.engagement.counterpart, RECOMMEND_PROTOCOL))) return false;
    const sent = await this.ctx.send(job, EnvelopeKind.enum.recommended, {});
    await this.ctx.store.saveJob({ ...sent, recommended_at: this.ctx.clock.now().toISOString() });
    return true;
  }

  // ── Worker ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The household on this job recommended this worker; someone they blocked is not worth telling them about. */
  async receive(job: JobRecord): Promise<void> {
    if (await this.blocks.isBlocked(job.engagement.counterpart)) {
      log.warn("recommendation dropped", { engagement: job.engagement.id, reason: "blocked" });
      return;
    }
    await this.ctx.store.saveJob({ ...job, recommended_at: this.ctx.clock.now().toISOString() });
  }

  /** The worker read it: it leaves their Activity. */
  async read(id: EngagementId): Promise<void> {
    const { recommended_at: _read, ...job } = await this.job(id);
    await this.ctx.store.saveJob(job);
  }

  private async job(id: EngagementId): Promise<JobRecord> {
    const job = await this.ctx.store.job(id);
    if (!job) throw new QrError(QrProblem.not_found);
    return job;
  }
}
