import { EngagementStatus, type Payment, PaymentStatus, UpdateCode } from "@gigsync/protocol";
import { bothSigned } from "../payments/passbook.js";
import { type KeptNote, reachedAt } from "./history.js";
import type { JobRecord } from "./store.js";

/**
 * The progress line a signed job shows on both apps: agreed, on the way, started (only when the worker said so), done,
 * paid, closed; or where it stopped, if it was cancelled. Each step with when this phone saw it, where it knows.
 */

export const Step = {
  agreed: "agreed",
  on_my_way: "on_my_way",
  started: "started",
  done: "done",
  paid: "paid",
  closed: "closed",
  cancelled: "cancelled",
} as const;
export type Step = (typeof Step)[keyof typeof Step];

/** One step: reached or still ahead, and when it was reached where this phone knows. */
export interface ProgressStep {
  step: Step;
  reached: boolean;
  at?: string;
}

const S = EngagementStatus.enum;
const U = UpdateCode.enum;
const PAID: ReadonlySet<string> = new Set([PaymentStatus.enum.paid, PaymentStatus.enum.confirmed]);
/** Statuses that mean the worker has set off, or gone further. */
const SET_OFF: ReadonlySet<EngagementStatus> = new Set([S.in_progress, S.delivered, S.revision, S.closed]);
/** Statuses that mean the work is done, or gone further. */
const DONE: ReadonlySet<EngagementStatus> = new Set([S.delivered, S.revision, S.closed]);

/** Update codes the progress line draws as steps of their own. */
const STEP_CODES: ReadonlySet<UpdateCode> = new Set([U.on_my_way, U.started, U.done]);

/** A note worth listing under the line: free text, or a code the line does not already show (running late). */
export const noteShown = (n: KeptNote): boolean => n.code === undefined || !STEP_CODES.has(n.code);

const noteAt = (r: JobRecord, code: UpdateCode) => r.notes?.find((n) => n.code === code)?.at;
const at = (value: string | undefined) => (value ? { at: value } : {});

/** The job's progress, or undefined for one not both signed (nor restored from the record), which has none yet. */
export function jobProgress(r: JobRecord, payments: readonly Payment[]): ProgressStep[] | undefined {
  if (!bothSigned(r) && !r.restored) return undefined;
  const status = r.engagement.status;
  const paid = payments
    .filter((p) => p.engagement === r.engagement.id && PAID.has(p.status))
    .map((p) => p.confirmed_at ?? p.paid_at)
    .sort()[0];
  const started = noteAt(r, U.started);
  const steps: ProgressStep[] = [
    { step: Step.agreed, reached: true, ...at(reachedAt(r, S.agreed) ?? r.restored?.agreed_at) },
    {
      step: Step.on_my_way,
      reached: SET_OFF.has(status) || noteAt(r, U.on_my_way) !== undefined,
      ...at(noteAt(r, U.on_my_way) ?? reachedAt(r, S.in_progress)),
    },
    ...(started ? [{ step: Step.started, reached: true, at: started }] : []),
    { step: Step.done, reached: DONE.has(status), ...at(reachedAt(r, S.delivered) ?? noteAt(r, U.done)) },
    { step: Step.paid, reached: paid !== undefined, ...at(paid) },
    { step: Step.closed, reached: status === S.closed, ...at(reachedAt(r, S.closed)) },
  ];
  if (status !== S.cancelled) return steps;
  // A cancelled job keeps what it reached, then says where it stopped.
  return [
    ...steps.filter((s) => s.reached),
    { step: Step.cancelled, reached: true, ...at(reachedAt(r, S.cancelled) ?? r.ended_at) },
  ];
}

/** Statuses in which the worker is still to finish the work, and either side may call it off. */
export const UNDER_WAY: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress]);

/** The worker's moves on a signed job, one at a time: on the way, then started, then done. */
export type WorkerStep = typeof U.on_my_way | typeof U.started | typeof U.done;

/**
 * The one move the worker makes next, read from the step notes the job keeps rather than its status: a free-text
 * note also moves a job to in progress, and must not skip "on my way". Undefined once the work is handed over.
 */
export function nextWorkerStep(r: JobRecord): WorkerStep | undefined {
  if (!UNDER_WAY.has(r.engagement.status)) return undefined;
  if (noteAt(r, U.on_my_way) === undefined) return U.on_my_way;
  return noteAt(r, U.started) === undefined ? U.started : U.done;
}
