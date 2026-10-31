import {
  DetailFlag,
  fitTerms,
  MAX_ROUNDS,
  MaterialsBy,
  QuestionKey,
  Role,
  TERMS_PROTOCOL,
  TermKey,
  Terms,
  type TermWhen,
  Trade,
  type UserId,
} from "@gigsync/protocol";
import type { Model } from "../ports.js";
import type { JobContext } from "./context.js";
import { countIn } from "./details.js";
import { type Move, MoveKind } from "./negotiate.js";
import type { JobRecord, Need } from "./store.js";
import {
  answerTerms,
  changedFromWants,
  householdStance,
  type TermPrefs,
  type TermsAnswer,
  workerStance,
} from "./terms.js";
import { chooseTerm } from "./terms-model.js";
import { dayOf } from "./when.js";

/**
 * The terms path of a job (ADR 0033 §3), between the agents' price moves: whether this job's offers carry terms at
 * all, what each side proposes next, and what a change of terms does to the job's scope. The price path reads only
 * `agreed`, and the details a term sets, so a term moves the price only through the estimate's scope.
 */

const Q = QuestionKey.enum;
const R = Role.enum;

/** On a job: whether both phones understand terms, and the terms this side proposes next. Never sent as is. */
export interface TermsTrack {
  on: boolean;
  next?: Terms;
}

/** Whether every phone of `user` understands terms; false when unsure, so an older phone never stalls. */
export async function speaksTerms(ctx: JobContext, user: UserId): Promise<boolean> {
  try {
    return await ctx.speaks(user, TERMS_PROTOCOL);
  } catch {
    return false;
  }
}

/** Whether this job's offers carry terms: decided once, when this side first plans the job. */
export const termsOn = (ctx: JobContext, r: JobRecord): Promise<boolean> =>
  r.terms ? Promise.resolve(r.terms.on) : speaksTerms(ctx, r.engagement.counterpart);

/** The terms this side proposes next, on a job whose offers carry them. */
export const nextTerms = (r: JobRecord): Terms | undefined => (r.terms?.on ? r.terms.next : undefined);

/**
 * A price move held back by terms still apart: an acceptable price is offered back as it stands, with this side's
 * terms, rather than accepted; after the last round the agent walks away as it would over price.
 */
export function withTerms(move: Move, agreed: boolean, theirPrice: number, offersMade: number): Move {
  if (move.kind !== MoveKind.accept || agreed) return move;
  if (offersMade >= MAX_ROUNDS) return { kind: MoveKind.walk };
  return { kind: MoveKind.offer, price_paise: theirPrice, round: offersMade + 1 };
}

/** `{ terms }` for an offer or the signed terms, with only the terms the trade negotiates; nothing when there are none. */
export function termsField(trade: Trade, terms: Terms | undefined): { terms?: Terms } {
  const fitted = terms && fitTerms(trade, terms);
  return fitted && Object.keys(fitted).length > 0 ? { terms: fitted } : {};
}

/**
 * The job details a set of terms decides, so the estimate's scope and the city band's rules read them (ADR 0030): who
 * buys the paint is the painter's `labour_only`, and coats and hours are counts.
 */
export function termDetails(trade: Trade, terms: Terms | undefined): Record<string, string> {
  const details: Record<string, string> = {};
  if (terms?.materials && trade === Trade.enum.painter)
    details[Q.labour_only] = terms.materials === MaterialsBy.enum.household ? DetailFlag.enum.yes : DetailFlag.enum.no;
  if (terms?.coats !== undefined) details[Q.coats] = String(terms.coats);
  if (terms?.hours !== undefined) details[Q.hours] = String(terms.hours);
  return details;
}

/**
 * The job with the details its proposed terms decide. When that changes a detail, the worker's price plan is dropped
 * so it is planned again for the new scope, by code, before the next offer.
 */
export function withTermDetails(r: JobRecord, terms: Terms | undefined): JobRecord {
  const decided = termDetails(r.request.trade, terms);
  const changed = Object.entries(decided).some(([key, value]) => r.request.details[key] !== value);
  if (!changed) return r;
  const { mandate: _m, advice: _a, estimate: _e, ...rest } = r;
  return { ...rest, request: { ...r.request, details: { ...r.request.details, ...decided } } };
}

/** The terms a household's own details already say: the inverse of `termDetails`, for its agent's stance. */
export function detailTerms(trade: Trade, details: Readonly<Record<string, string>>): Terms {
  const labour = DetailFlag.safeParse(details[Q.labour_only]).data;
  const materials = labour && (labour === DetailFlag.enum.yes ? MaterialsBy.enum.household : MaterialsBy.enum.worker);
  const counts = Terms.pick({ coats: true, hours: true }).safeParse({
    coats: countIn(details[Q.coats]),
    hours: countIn(details[Q.hours]),
  });
  return fitTerms(trade, { ...(materials ? { materials } : {}), ...(counts.success ? counts.data : {}) });
}

/** The times this worker has already agreed to, from jobs both sides signed. */
export function bookedTimes(jobs: readonly JobRecord[]): TermWhen[] {
  return jobs.flatMap((j) => {
    const both = j.engagement.role === R.provider && j.mine && j.mine.terms_hash === j.theirs?.terms_hash;
    const when = both && !j.cancel ? j.mine?.terms.terms?.when : undefined;
    return when ? [when] : [];
  });
}

/** Each countered term set to the option a model chose from the list code generated; the first without a model. */
async function chosen(model: Model | undefined, answer: TermsAnswer, owner?: string, other?: string): Promise<Terms> {
  const next: Record<string, unknown> = { ...answer.next };
  for (const key of TermKey.options) {
    const options = answer.options[key];
    if (!options || options.length <= 1) continue;
    const pick = await chooseTerm(model, { key, options, ...(owner ? { owner } : {}), ...(other ? { other } : {}) });
    next[key] = options[pick];
  }
  return Terms.parse(next);
}

export interface TermsMove {
  r: JobRecord;
  /** The other side's terms are acceptable as they are (always, on a job without terms). */
  agreed: boolean;
  /** No acceptable value is near what the other side asked for a term (every window booked, say): no deal. */
  stuck?: boolean;
}

/**
 * The worker's agent answers the household's terms (the request's, then each counter's), from the worker's card
 * preferences and the times they already agreed. Its proposal sets the job's details, so a change of materials or
 * hours is priced through the scope before the offer goes out.
 */
export async function workerTerms(
  ctx: JobContext,
  prefs: TermPrefs | undefined,
  r: JobRecord,
  theirs: Terms | undefined,
): Promise<TermsMove> {
  const on = await termsOn(ctx, r);
  if (!on) return { r: r.terms ? r : { ...r, terms: { on } }, agreed: true };
  const trade = r.request.trade;
  const stance = workerStance(prefs, bookedTimes(await ctx.store.jobs()), dayOf(r.request));
  const answer = answerTerms(trade, stance, theirs && fitTerms(trade, theirs));
  // The worker wrote nothing for this job; the household's words let the model suit them, inside the list.
  const next = await chosen(ctx.model, answer, undefined, r.request.need);
  const moved = withTermDetails({ ...r, terms: { on, next } }, next);
  return { r: moved, agreed: answer.agreed, stuck: answer.stuck.length > 0 };
}

/** The terms the worker's agent proposed in its last offer before the newest one: a value repeated is firm. */
function workerBefore(r: JobRecord): Terms | undefined {
  const theirs = r.offers.filter((o) => o.by === R.provider);
  return theirs.at(-2)?.offer.terms;
}

/** The household's agent answers the worker's terms, from its owner's own words and chips (`Need.terms`). */
export async function householdTerms(
  ctx: JobContext,
  need: Need,
  r: JobRecord,
  theirs: Terms | undefined,
): Promise<TermsMove> {
  const on = await termsOn(ctx, r);
  if (!on) return { r: r.terms ? r : { ...r, terms: { on } }, agreed: true };
  const trade = r.request.trade;
  const wants = { ...detailTerms(trade, need.details), ...need.terms };
  const stance = householdStance(wants, need.flexible ?? [], workerBefore(r));
  const answer = answerTerms(trade, stance, theirs && fitTerms(trade, theirs));
  const next = await chosen(ctx.model, answer, need.need);
  return { r: { ...r, terms: { on, next } }, agreed: answer.agreed };
}

/**
 * The household's agent never signs on its own terms its owner did not ask for: a deal that changes a term they
 * named waits for them, auto-confirm or not. The worker's agent only ever accepts terms inside its owner's rules.
 */
export async function mustReview(ctx: JobContext, r: JobRecord, terms: Terms | undefined): Promise<boolean> {
  // On a job without terms (an older phone), nothing was negotiated besides the price: signing is as before.
  if (r.engagement.role !== R.requester || !r.terms?.on) return false;
  const need = await ctx.store.need(r.engagement.group);
  const wants = need ? { ...detailTerms(need.trade, need.details), ...need.terms } : {};
  return changedFromWants(wants, terms).length > 0;
}

/** The household's terms for its request: the owner's, to a worker whose phones understand them. */
export function requestTerms(need: Need, on: boolean): { terms?: Terms } {
  return on ? termsField(need.trade, need.terms) : {};
}
