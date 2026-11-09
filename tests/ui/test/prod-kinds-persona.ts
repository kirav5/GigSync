import type { WorkKind } from "@gigsync/protocol";

/**
 * One worker and one household for every kind of work (ADR 0061), for the production run (prod-kinds.spec.ts). Each
 * says what they want in their own words, some in English and some in Hinglish or Kanglish as people type them, so
 * the run shows how the model reads them, not how a test names a kind. Amounts are rupees; the household's budget
 * sits near the worker's usual rate, so the agents can agree.
 */

export type Arrangement = "hourly" | "visit" | "weekly" | "monthly";

export interface KindPersona {
  kind: WorkKind;
  /** What the worker says when the card interview asks what work they do. */
  worker: string;
  /** Another kind in the same group the worker also does, ticked at "also do any of these?". */
  also?: WorkKind;
  /** The also kind's own usual rate, when it differs. */
  alsoRate?: number;
  /** How the work is taken, when the interview asks. */
  arrangement: Arrangement;
  rate: number;
  min: number;
  about: string;
  /** What the worker needs to know before quoting, in their words (ADR 0063). */
  asks: string;
  /** What the household types first in Find. */
  need: string;
  budget: number;
  /** The household's answer to any written question it is asked, in its words. */
  answer: string;
}

export const V = "visit" as const;
export const M = "monthly" as const;
export const H = "hourly" as const;
