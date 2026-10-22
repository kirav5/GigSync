import {
  type Engagement,
  type EngagementBrief,
  type EngagementId,
  EngagementStatus,
  EnvelopeKind,
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
    status: EngagementStatus.enum.draft,
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

const K = EnvelopeKind.enum;
/** Kinds a person can choose to send; receipt and key_change are sent by the system. */
const SENDABLE: readonly EnvelopeKind[] = [
  K.request,
  K.clarify,
  K.response,
  K.quote,
  K.agree,
  K.update,
  K.delivery,
  K.review,
  K.cancel,
];
const BY_SIDE: Readonly<Record<Role, ReadonlySet<EnvelopeKind>>> = {
  requester: new Set([K.request, K.response, K.agree, K.review, K.cancel, K.clarify]),
  provider: new Set([K.clarify, K.response, K.quote, K.update, K.delivery, K.cancel]),
};

/** Envelope kinds a side may send in the current state, so the UI only offers real actions. */
export function allowedKinds(e: Engagement): EnvelopeKind[] {
  return SENDABLE.filter((k) => nextStatus(e.status, k) && BY_SIDE[e.role].has(k));
}
