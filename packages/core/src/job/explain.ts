import { Role, TermKey, type Terms } from "@gigsync/protocol";
import { basisCount } from "../estimate/scope.js";
import { ReasonKind } from "./advice.js";
import type { JobRecord } from "./store.js";
import { sameTerm } from "./terms.js";

/**
 * The facts behind one offer, built by code from this phone's record (ADR 0033 §4): who moved, from what to what, the
 * usual rate and what it rests on, the terms that changed, and the owner's own limit. A model may phrase them
 * (`explain-model.ts`); every number it writes must be one of these. The limit is the owner's and only ever explained
 * to them: explanations are never sent.
 */

export const FactKind = {
  opened: "opened",
  moved: "moved",
  held: "held",
  usual: "usual",
  limit: "limit",
  terms: "terms",
} as const;

export type Fact =
  /** This side's or the other side's first offer. */
  | { kind: typeof FactKind.opened; mine: boolean; price_paise: number }
  /** A side moved its price from its last offer. */
  | { kind: typeof FactKind.moved; mine: boolean; from_paise: number; to_paise: number; delta_paise: number }
  /** A side kept its price and moved only the terms. */
  | { kind: typeof FactKind.held; mine: boolean; price_paise: number }
  /** The usual rate for this job, from the estimate (or the worker's band), with the GigSync jobs it rests on. */
  | {
      kind: typeof FactKind.usual;
      low_paise: number;
      high_paise: number;
      typical_paise?: number;
      jobs?: number;
    }
  /**
   * The owner's own limit (a worker's lowest price, a household's budget), how far the offer is from it and on which
   * side: the direction is stated, never left to "past", which a model rewording it read as "over" for an offer under.
   */
  | {
      kind: typeof FactKind.limit;
      owner: Role;
      limit_paise: number;
      gap_paise: number;
      side: LimitSide;
      within: boolean;
    }
  /** The terms an offer proposes that differ from what the other side had on the table. */
  | { kind: typeof FactKind.terms; mine: boolean; changed: TermKey[]; terms: Terms };

/** The last offer before `index` that `match` picks. */
const lastBefore = (job: JobRecord, index: number, match: (by: Role) => boolean) =>
  job.offers
    .slice(0, index)
    .filter((o) => match(o.by))
    .at(-1)?.offer;

/** Where an offer stands against the owner's limit. */
export const LimitSide = { above: "above", below: "below", at: "at" } as const;
export type LimitSide = (typeof LimitSide)[keyof typeof LimitSide];

const sideOf = (price: number, limit: number): LimitSide =>
  price > limit ? LimitSide.above : price < limit ? LimitSide.below : LimitSide.at;

/** An offer below the household's limit, or above the worker's, is within it. */
const withinLimit = (owner: Role, price: number, limit: number) =>
  owner === Role.enum.provider ? price >= limit : price <= limit;

/** The usual rate as this phone knows it: the job's estimate, else the worker's planning band. */
function usualOf(job: JobRecord): Fact | undefined {
  const e = job.estimate;
  if (e) {
    const range = { low_paise: e.low_paise, high_paise: e.high_paise, typical_paise: e.typical_paise };
    return { kind: FactKind.usual, ...range, ...basisCount(e) };
  }
  const band = job.advice?.reasons.find((r) => r.kind === ReasonKind.band);
  if (band?.kind !== ReasonKind.band) return undefined;
  return { kind: FactKind.usual, low_paise: band.low_paise, high_paise: band.high_paise };
}

/** The terms an offer proposes that differ from the other side's last proposal before it. */
export function changedTerms(job: JobRecord, index: number): TermKey[] {
  const { by, offer } = job.offers[index] ?? {};
  if (!offer?.terms) return [];
  const before = lastBefore(job, index, (b) => b !== by)?.terms ?? job.request.terms;
  return TermKey.options.filter(
    (key) => offer.terms?.[key] !== undefined && !sameTerm(key, offer.terms[key], before?.[key]),
  );
}

/**
 * The facts for the offer at `index` in the job's story, for this phone's owner. `limit_paise` is the owner's own
 * limit (the household's budget, the worker's plan), when this phone has it.
 */
export function offerFacts(job: JobRecord, index: number, limit_paise?: number): Fact[] {
  const at = job.offers[index];
  if (!at) return [];
  const role = job.engagement.role;
  const mine = at.by === role;
  const price = at.offer.price_paise;
  const before = lastBefore(job, index, (b) => b === at.by)?.price_paise;
  const facts: Fact[] = [];
  if (before === undefined) facts.push({ kind: FactKind.opened, mine, price_paise: price });
  else if (before === price) facts.push({ kind: FactKind.held, mine, price_paise: price });
  else
    facts.push({
      kind: FactKind.moved,
      mine,
      from_paise: before,
      to_paise: price,
      delta_paise: Math.abs(price - before),
    });
  const changed = changedTerms(job, index);
  if (changed.length > 0 && at.offer.terms) facts.push({ kind: FactKind.terms, mine, changed, terms: at.offer.terms });
  const usual = usualOf(job);
  if (usual) facts.push(usual);
  if (limit_paise !== undefined) {
    const gap_paise = Math.abs(price - limit_paise);
    const side = sideOf(price, limit_paise);
    facts.push({
      kind: FactKind.limit,
      owner: role,
      limit_paise,
      gap_paise,
      side,
      within: withinLimit(role, price, limit_paise),
    });
  }
  return facts;
}
