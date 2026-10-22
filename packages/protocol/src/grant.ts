import { z } from "zod";
import { GrantId, UserId } from "./ids.js";

/** What a contact may ask about. */
export const Topic = z.enum(["availability", "location", "status", "context"]);
export type Topic = z.infer<typeof Topic>;

/** Coarsest first, so a smaller index is always safer. */
export const Precision = z.enum(["city", "neighbourhood", "street", "exact"]);
export type Precision = z.infer<typeof Precision>;
export const PRECISION_ORDER: readonly Precision[] = ["city", "neighbourhood", "street", "exact"];

/**
 * auto: answer without asking. review: draft, owner approves before it is sent. ask: owner approves each time
 * before anything is drafted. Ordered from least to most owner involvement.
 */
export const ApprovalMode = z.enum(["auto", "review", "ask"]);
export type ApprovalMode = z.infer<typeof ApprovalMode>;
export const MODE_ORDER: readonly ApprovalMode[] = ["auto", "review", "ask"];

/** Inclusive start hour (0–23), exclusive end (1–24), owner's local time. */
export const HourWindow = z.object({ start: z.number().int().min(0).max(23), end: z.number().int().min(1).max(24) });

export const Grant = z.object({
  id: GrantId,
  grantee: UserId,
  topic: Topic,
  mode: ApprovalMode,
  /** Only for location. Absent means the owner did not limit it; the engine then uses the coarsest. */
  precision: Precision.optional(),
  hours: HourWindow.optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
});
export type Grant = z.infer<typeof Grant>;

/** What another agent is asking for, after the router has grounded it. */
export const AccessRequest = z.object({
  from: UserId,
  topic: Topic,
  precision: Precision.optional(),
  /** When the question is asked, owner's local time. */
  at: z.string().datetime({ offset: true }),
  local_hour: z.number().int().min(0).max(23),
});
export type AccessRequest = z.infer<typeof AccessRequest>;

/** Why the policy engine said no. */
export const DenyReason = z.enum(["no_grant", "outside_hours", "expired"]);
export type DenyReason = z.infer<typeof DenyReason>;

export const Decision = z.discriminatedUnion("allow", [
  z.object({
    allow: z.literal(true),
    mode: ApprovalMode,
    precision: Precision.optional(),
    grant: GrantId,
  }),
  z.object({
    allow: z.literal(false),
    reason: DenyReason,
  }),
]);
export type Decision = z.infer<typeof Decision>;
