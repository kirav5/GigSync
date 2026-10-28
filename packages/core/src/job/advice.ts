import {
  EngagementStatus,
  type QuestionKey,
  type RateBand,
  Role,
  ScopeKind,
  type ScopeRule,
  type Trade,
} from "@gigsync/protocol";
import { countIn, present } from "./details.js";
import { type Mandate, PRICE_STEP_PAISE } from "./negotiate.js";
import type { JobRecord } from "./store.js";

/**
 * The worker's agent proposes a price plan (an opening price and a private limit) from three kinds of data: the
 * city's band for the trade, adjusted for this job's scope; what this worker was actually paid before; and the floor
 * they set. Plain arithmetic, the same for every worker and checkable by a union steward. No model produces a number;
 * a model may only reword the reasons (agent-flows §1.1).
 */

/** Open a little above what the worker usually gets, so there is room to concede. */
const HISTORY_UPLIFT = 0.1;
/** Scope rules may cut the band, but never below half of it. */
const MIN_SCOPE_FACTOR = 0.5;
const PERCENT = 100;

export const ReasonKind = { band: "band", scope: "scope", history: "history", floor: "floor", plan: "plan" } as const;

/** Why the agent proposes what it proposes, as data. Each phone renders it in its owner's language (`reasonText`). */
export type Reason =
  | { kind: typeof ReasonKind.band; low_paise: number; high_paise: number }
  | { kind: typeof ReasonKind.scope; key: QuestionKey; percent: number }
  | { kind: typeof ReasonKind.history; median_paise: number; count: number }
  | { kind: typeof ReasonKind.floor; floor_paise: number }
  | { kind: typeof ReasonKind.plan; opening_paise: number; limit_paise: number };

export interface Advice {
  mandate: Mandate;
  reasons: Reason[];
}

export interface AdviceInput {
  band: RateBand;
  /** The job's details by key, as the consumer gave them up front or in answers. */
  details: Readonly<Record<string, string>>;
  /** Prices this worker agreed before for the same trade, in paise. */
  history: readonly number[];
  /** The least the worker will take for any job of this trade. */
  floor_paise: number;
}

/**
 * Rounded up to the next whole ₹10, as people quote prices; in the worker's favour. Rounds to whole paise first, so
 * float noise (950000 × 1.1 = 1045000.0000000001) never adds ₹10.
 */
const roundUp = (paise: number) => Math.ceil(Math.round(paise) / PRICE_STEP_PAISE) * PRICE_STEP_PAISE;

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] as number;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] as number) + upper) / 2;
}

/** The percentage each scope rule adds for these details; rules that do not apply are left out. */
function scopeApplied(rules: readonly ScopeRule[], details: Readonly<Record<string, string>>) {
  const applied: { key: QuestionKey; percent: number }[] = [];
  for (const rule of rules) {
    const value = details[rule.key];
    const percent =
      rule.kind === ScopeKind.enum.flag
        ? present(value)
          ? rule.percent
          : 0
        : rule.percent * Math.max(0, (countIn(value) ?? 0) - rule.included);
    if (percent !== 0) applied.push({ key: rule.key, percent });
  }
  return applied;
}

/** The plan: limit = the higher of the floor and the scoped band's low; opening from history, capped by the band. */
export function proposeMandate(i: AdviceInput): Advice {
  const applied = scopeApplied(i.band.scope, i.details);
  const factor = Math.max(MIN_SCOPE_FACTOR, 1 + applied.reduce((sum, a) => sum + a.percent, 0) / PERCENT);
  const low = roundUp(i.band.low_paise * factor);
  const high = roundUp(i.band.high_paise * factor);
  const limit = roundUp(Math.max(i.floor_paise, low));
  const usual = median(i.history);
  const fromHistory = usual === undefined ? undefined : roundUp(usual * factor * (1 + HISTORY_UPLIFT));
  const opening = Math.max(limit, Math.min(high, fromHistory ?? high));

  const reasons: Reason[] = [{ kind: ReasonKind.band, low_paise: low, high_paise: high }];
  for (const a of applied) reasons.push({ kind: ReasonKind.scope, ...a });
  if (usual !== undefined) reasons.push({ kind: ReasonKind.history, median_paise: usual, count: i.history.length });
  if (i.floor_paise >= low) reasons.push({ kind: ReasonKind.floor, floor_paise: i.floor_paise });
  reasons.push({ kind: ReasonKind.plan, opening_paise: opening, limit_paise: limit });
  return { mandate: { opening_paise: opening, limit_paise: limit }, reasons };
}

/** What this worker was paid in jobs of the trade that both sides signed and nobody cancelled. */
export function pastPrices(jobs: readonly JobRecord[], trade: Trade): number[] {
  return jobs
    .filter(
      (r) =>
        r.engagement.role === Role.enum.provider &&
        r.request.trade === trade &&
        r.engagement.status !== EngagementStatus.enum.cancelled &&
        r.mine !== undefined &&
        r.mine.terms_hash === r.theirs?.terms_hash,
    )
    .map((r) => r.mine?.terms.price_paise as number);
}
