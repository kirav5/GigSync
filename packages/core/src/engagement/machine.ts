import {
  type Engagement,
  type EngagementBrief,
  type EngagementId,
  type EnvelopeKind,
  nextStatus,
  type Role,
  TERMINAL_STATUSES,
  type UserId,
} from "@collab/protocol";
import { ulid } from "ulid";

export class TransitionError extends Error {
  constructor(
    readonly engagement: EngagementId,
    readonly from: Engagement["status"],
    readonly kind: EnvelopeKind,
  ) {
    super(`engagement ${engagement}: ${kind} is not allowed from ${from}`);
  }
}

export function newEngagement(
  input: { role: Role; counterpart: UserId; brief: EngagementBrief; group?: EngagementId },
  now: Date,
): Engagement {
  const id = `eng_${ulid(now.getTime())}`;
  const at = now.toISOString();
  return {
    id,
    group: input.group ?? id,
    role: input.role,
    counterpart: input.counterpart,
    status: "draft",
    brief: input.brief,
    created_at: at,
    updated_at: at,
  };
}

/** Applies one envelope kind. Pure: returns a new engagement or throws, never mutates. */
export function apply(e: Engagement, kind: EnvelopeKind, now: Date): Engagement {
  const to = nextStatus(e.status, kind);
  if (!to) throw new TransitionError(e.id, e.status, kind);
  return { ...e, status: to, updated_at: now.toISOString() };
}

export const isOpen = (e: Engagement) => !TERMINAL_STATUSES.has(e.status);

/** Envelope kinds a side may send in the current state, so the UI only offers real actions. */
export function allowedKinds(e: Engagement): EnvelopeKind[] {
  const all: EnvelopeKind[] = [
    "request",
    "clarify",
    "response",
    "quote",
    "agree",
    "update",
    "delivery",
    "review",
    "cancel",
  ];
  const bySide: Record<Role, Set<EnvelopeKind>> = {
    requester: new Set(["request", "response", "agree", "review", "cancel", "clarify"]),
    provider: new Set(["clarify", "response", "quote", "update", "delivery", "cancel"]),
  };
  return all.filter((k) => nextStatus(e.status, k) && bySide[e.role].has(k));
}
