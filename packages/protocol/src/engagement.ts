import { z } from "zod";
import type { EnvelopeKind } from "./envelope.js";
import { ChainId, EngagementId, UserId } from "./ids.js";

/**
 * One interaction between two agents about one brief. The same object for a one-line question and a week-long job;
 * a question simply stops at `closed` after `responded`.
 */
export const EngagementStatus = z.enum([
  "draft",
  "sent",
  "clarifying",
  "responded",
  "agreed",
  "in_progress",
  "delivered",
  "revision",
  "closed",
  "declined",
  "expired",
  "cancelled",
]);
export type EngagementStatus = z.infer<typeof EngagementStatus>;

const S = EngagementStatus.enum;

export const TERMINAL_STATUSES: ReadonlySet<EngagementStatus> = new Set([S.closed, S.declined, S.expired, S.cancelled]);

export const Role = z.enum(["requester", "provider"]);
export type Role = z.infer<typeof Role>;

/** Which envelope kinds move an engagement from each status, and where to. */
export const TRANSITIONS: Readonly<Record<EngagementStatus, Partial<Record<EnvelopeKind, EngagementStatus>>>> = {
  draft: { request: S.sent },
  sent: { clarify: S.clarifying, response: S.responded, quote: S.responded, cancel: S.declined, receipt: S.expired },
  clarifying: { response: S.sent, cancel: S.declined, receipt: S.expired },
  responded: { agree: S.agreed, review: S.closed, cancel: S.cancelled, receipt: S.expired },
  agreed: { update: S.in_progress, delivery: S.delivered, cancel: S.cancelled },
  in_progress: { update: S.in_progress, delivery: S.delivered, cancel: S.cancelled },
  delivered: { review: S.closed, clarify: S.revision, receipt: S.closed },
  revision: { delivery: S.delivered, cancel: S.cancelled },
  closed: {},
  declined: {},
  expired: {},
  cancelled: {},
};

export function nextStatus(from: EngagementStatus, kind: EnvelopeKind): EngagementStatus | null {
  return TRANSITIONS[from][kind] ?? null;
}

/** Google A2A task states (the spec's spelling, including its "canceled"). */
export const A2aTaskState = z.enum([
  "submitted",
  "input-required",
  "working",
  "completed",
  "rejected",
  "failed",
  "canceled",
]);
export type A2aTaskState = z.infer<typeof A2aTaskState>;
const A = A2aTaskState.enum;
const inputRequired = A["input-required"];

/** Collab status → Google A2A task state, for the gateway planned at the edge. */
export const A2A_STATE: Readonly<Record<EngagementStatus, A2aTaskState>> = {
  draft: A.submitted,
  sent: A.submitted,
  clarifying: inputRequired,
  responded: inputRequired,
  agreed: A.working,
  in_progress: A.working,
  delivered: inputRequired,
  revision: A.working,
  closed: A.completed,
  declined: A.rejected,
  expired: A.failed,
  cancelled: A.canceled,
};

export const EngagementBrief = z.object({
  /** Plain words the owner typed or approved. Never a model's paraphrase alone. */
  text: z.string().min(1).max(2000),
  topic: z.string().min(1).max(64),
  /** Fields the owner agreed to share with the other side. Everything else stays home. */
  shared: z.record(z.string(), z.string()).default({}),
});
export type EngagementBrief = z.infer<typeof EngagementBrief>;

export const Engagement = z.object({
  id: EngagementId,
  /** Requests fanned out to several providers share a group; agreeing with one cancels the rest. */
  group: EngagementId,
  role: Role,
  counterpart: UserId,
  status: EngagementStatus,
  brief: EngagementBrief,
  chain: z.object({ id: ChainId, depth: z.number().int().min(1) }).optional(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Engagement = z.infer<typeof Engagement>;
