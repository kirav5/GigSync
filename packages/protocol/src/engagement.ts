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

export const TERMINAL_STATUSES: ReadonlySet<EngagementStatus> = new Set(["closed", "declined", "expired", "cancelled"]);

export const Role = z.enum(["requester", "provider"]);
export type Role = z.infer<typeof Role>;

/** Which envelope kinds move an engagement from each status, and where to. */
export const TRANSITIONS: Readonly<Record<EngagementStatus, Partial<Record<EnvelopeKind, EngagementStatus>>>> = {
  draft: { request: "sent" },
  sent: { clarify: "clarifying", response: "responded", quote: "responded", cancel: "declined", receipt: "expired" },
  clarifying: { response: "sent", cancel: "declined", receipt: "expired" },
  responded: { agree: "agreed", review: "closed", cancel: "cancelled", receipt: "expired" },
  agreed: { update: "in_progress", delivery: "delivered", cancel: "cancelled" },
  in_progress: { update: "in_progress", delivery: "delivered", cancel: "cancelled" },
  delivered: { review: "closed", clarify: "revision", receipt: "closed" },
  revision: { delivery: "delivered", cancel: "cancelled" },
  closed: {},
  declined: {},
  expired: {},
  cancelled: {},
};

export function nextStatus(from: EngagementStatus, kind: EnvelopeKind): EngagementStatus | null {
  return TRANSITIONS[from][kind] ?? null;
}

/** Collab status → Google A2A task state, for the gateway planned at the edge. */
export const A2A_STATE: Readonly<Record<EngagementStatus, string>> = {
  draft: "submitted",
  sent: "submitted",
  clarifying: "input-required",
  responded: "input-required",
  agreed: "working",
  in_progress: "working",
  delivered: "input-required",
  revision: "working",
  closed: "completed",
  declined: "rejected",
  expired: "failed",
  cancelled: "canceled",
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
