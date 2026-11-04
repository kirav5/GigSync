import {
  type Answers,
  CancelReason,
  type Clarify,
  DEFAULT_ARRANGEMENT,
  EnvelopeKind,
  type Estimate,
  isTrade,
  type JobRequest,
  type Offer,
  type Place,
  QuestionKey,
  type RateCard,
  Role,
  SCOPE_MAX,
  SKIPPED,
  type Skill,
  skillKey,
  type Trade,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { localitySlug } from "../address/book.js";
import { areaKeyOf } from "../estimate/areas.js";
import { estimateBand } from "../estimate/band.js";
import { lookupEstimate } from "../estimate/lookup.js";
import { basisCount, estimateRequest, perJob } from "../estimate/scope.js";
import { pastPrices, proposeMandate } from "./advice.js";
import { type ArrangementMandate, arrangementMandate, askedArrangement, rateFor } from "./arrangement-rules.js";
import { questionsFor } from "./ask.js";
import type { JobContext } from "./context.js";
import { accept, cancel, termsFor } from "./deal.js";
import { present } from "./details.js";
import { AGENT_OFFERS, answering, handOver } from "./handover.js";
import { type Mandate, MoveKind, priceAt, respond } from "./negotiate.js";
import { type JobRecord, TaskKind } from "./store.js";
import { drawStrategy, type Strategy } from "./strategy.js";
import { usualTactic } from "./tactic.js";
import type { TermPrefs } from "./terms.js";
import { nextTerms, termsField, withTermDetails, withTerms, workerTerms } from "./terms-flow.js";

/** The standard questions live with the rest of the asking; screens and the interview read them from here. */
export { QUESTIONS } from "./ask.js";

const K = EnvelopeKind.enum;
const R = Role.enum;

/**
 * A worker's private rules: what they do, where, and at what price. Only the public part is on the board. Their UPI ID
 * is not a rule: it lives once in settings (`payments/payee.ts`), read when a payment is asked for.
 */
export interface WorkerRules {
  trades: Trade[];
  /** ADR 0047: work outside the trades, in the worker's own words, as their card lists it; absent before skills. */
  skills?: Skill[];
  /**
   * Opening = the usual rate shown on the board; limit = the least they will take for any job. When the city's rates
   * cover the trade, each job's plan comes from them instead, never below this limit.
   */
  rate: Mandate;
  /** The city pack's going rates, if the worker has it. */
  rates?: RateCard;
  /** Details that make the agent show the worker a request before quoting, e.g. pets. */
  ask_me?: QuestionKey[];
  /** Where they work from and how far they go. Requests from further away are declined. */
  base: Place;
  /** ADR 0045: the base's name when it is not a pilot area ("Banashankari"), as the card shows it. */
  base_name?: string;
  radius_km: number;
  /** When they take work, who buys materials, a day's hours: what their agent agrees besides the price. */
  terms?: TermPrefs;
  /**
   * The rules came back from the public card on a new phone (transfer/refill.ts) and the worker has not given their
   * lowest price yet: the agent shows them every request before quoting, from the usual rate.
   */
  floor_missing?: boolean;
  /** ADR 0046: the arrangements a maid or driver takes, each with its own plan; absent means monthly only. */
  arrangements?: ArrangementMandate[];
}

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;
export function distanceKm(a: Place, b: Place): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** The worker does this work: one of their trades, or a skill on their card by its key (ADR 0047 §5). */
export function doesWork(rules: Pick<WorkerRules, "trades" | "skills">, req: Pick<JobRequest, "trade" | "skill">) {
  if (isTrade(req.trade)) return rules.trades.includes(req.trade);
  const asked = req.skill && skillKey(req.skill.text);
  return (rules.skills ?? []).some((s) => skillKey(s.text) === asked);
}

/** A new request: decline what this worker does not do, ask what is missing, otherwise quote. */
export async function onRequest(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  const req = r.request;
  const takes = arrangementMandate(rules, req) !== undefined;
  if (!doesWork(rules, req) || distanceKm(rules.base, req.area) > rules.radius_km || !takes)
    return cancel(ctx, r, { reason: CancelReason.enum.no_match });
  // The household's terms answer the details they decide (who buys the paint): its agent need not ask them.
  const told = withTermDetails(r, req.terms);
  if (!told.asked) {
    const questions = await questionsFor(ctx, rules, told);
    if (questions.length > 0)
      return ctx.send({ ...told, asked: true, questions }, K.clarify, { questions } satisfies Clarify);
  }
  return quoteNext(ctx, rules, told);
}

/**
 * Only answers to standard questions become the job's details, which the price rules and the scope read; answers to
 * the model's questions, and skipped ones, are kept for the worker to read.
 */
export function onAnswers(ctx: JobContext, rules: WorkerRules, r: JobRecord, body: Answers): Promise<JobRecord> {
  const structured = Object.entries(body.answers).filter(
    ([key, text]) => QuestionKey.safeParse(key).success && text !== SKIPPED,
  );
  const request = { ...r.request, details: { ...r.request.details, ...Object.fromEntries(structured) } };
  return quoteNext(ctx, rules, { ...r, request, answers: { ...r.answers, ...body.answers } });
}

/** The worker took a request their rules said to show them first: the agent quotes now. */
export async function approve(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  await ctx.store.removeTask(TaskKind.approveRequest, r.engagement.id);
  return quoteNext(ctx, rules, { ...r, owner_ok: true });
}

/** The worker turned down a request their rules said to show them first. */
export async function refuse(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  await ctx.store.removeTask(TaskKind.approveRequest, r.engagement.id);
  return cancel(ctx, r, { reason: CancelReason.enum.declined_by_owner });
}

/** The estimate for this job's scope, for the whole job; undefined when there is none or it cannot be had. */
async function jobEstimate(ctx: JobContext, r: JobRecord, trade: Trade): Promise<Estimate | undefined> {
  const { details, area, locality } = r.request;
  // A pilot area by its point, else the locality the household's phone named (ADR 0045).
  const key = areaKeyOf(area) ?? (locality ? localitySlug(locality) : undefined);
  const request = ctx.estimates && estimateRequest(ctx.estimates.city, trade, details, key);
  if (!ctx.estimates || !request) return undefined;
  const found = await lookupEstimate(ctx.estimates.api, request);
  return found && perJob(found, details);
}

/**
 * The job's hidden strategy (ADR 0033), drawn once when it is first planned, with the tactic the worker chose in
 * Settings; nothing the household wrote picks it. A job that already made offers on the old fixed curve keeps it.
 */
async function strategyFor(ctx: JobContext, r: JobRecord): Promise<Strategy | undefined> {
  if (r.strategy || r.offers_made > 0) return r.strategy;
  return drawStrategy(R.provider, await usualTactic(ctx.storage), ctx.random);
}

/**
 * This job's plan: from the estimate for its scope when there is one (ADR 0030), else the city's band for the trade,
 * else the worker's own rate. The estimate is kept on the job, for the note on an offer far outside it.
 */
async function planFor(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  if (r.mandate) return r;
  const strategy = await strategyFor(ctx, r);
  const drawn = { ...r, ...(strategy ? { strategy } : {}) };
  const trade = r.request.trade;
  // Other work has no estimate or band (ADR 0047 §6): the worker's own usual and lowest rates are the plan.
  if (!isTrade(trade)) return { ...drawn, mandate: rateFor(rules, r.request) };
  // The city pack's band is monthly: for work by the hour, the visit or the week only the estimate in its unit counts.
  const rate = rateFor(rules, r.request);
  const monthly = askedArrangement(r.request) === DEFAULT_ARRANGEMENT;
  const cityBand = monthly ? rules.rates?.bands.find((b) => b.trade === trade) : undefined;
  const estimate = await jobEstimate(ctx, r, trade);
  const band = estimate ? estimateBand(estimate, trade, cityBand) : cityBand;
  if (!band) return { ...drawn, mandate: rate };
  const history = pastPrices(await ctx.store.jobs(), trade);
  const legal = estimate?.basis.legal_minimum_paise;
  const advice = proposeMandate({
    band,
    details: r.request.details,
    history,
    floor_paise: rate.limit_paise,
    ...(estimate ? { ...basisCount(estimate), typical_paise: estimate.typical_paise } : {}),
    ...(legal ? { legal_paise: legal } : {}),
    ...(strategy ? { opening_at: strategy.opening } : {}),
  });
  return { ...drawn, mandate: advice.mandate, advice, ...(estimate ? { estimate } : {}) };
}

/** Plans the job, shows it to the worker first if a flagged detail is present, otherwise makes the next offer. */
async function quoteNext(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  // Terms first: what the worker proposes sets the job's scope, which the plan is priced from.
  const { r: termed, stuck } = await workerTerms(ctx, rules.terms, r, r.request.terms);
  if (stuck) return cancel(ctx, termed, { reason: CancelReason.enum.no_deal });
  const planned = await planFor(ctx, rules, termed);
  const flagged = (rules.ask_me ?? []).filter((key) => present(planned.request.details[key]));
  const noFloor = rules.floor_missing === true;
  if ((flagged.length > 0 || noFloor) && !planned.owner_ok) {
    const detail = {
      flagged,
      mandate: planned.mandate,
      advice: planned.advice,
      ...(noFloor ? { no_floor: true } : {}),
    };
    await ctx.store.addTask(TaskKind.approveRequest, planned.engagement.id, detail, ctx.clock.now());
    await ctx.store.saveJob(planned);
    return planned;
  }
  const plan = planned.mandate ?? rateFor(rules, planned.request);
  return quote(ctx, planned, priceAt(R.provider, plan, planned.offers_made + 1, planned.strategy));
}

/** The consumer countered: accept, or concede one step; a talk its agent has made its offers in waits for the owner. */
export async function onCounter(
  ctx: JobContext,
  rules: WorkerRules,
  found: JobRecord,
  offer: Offer,
): Promise<JobRecord> {
  const r = await answering(ctx, found);
  const termed = await workerTerms(
    ctx,
    rules.terms,
    { ...r, offers: [...r.offers, { by: R.requester, offer }] },
    offer.terms,
  );
  if (termed.stuck) return cancel(ctx, termed.r, { reason: CancelReason.enum.no_deal });
  const withOffer = await planFor(ctx, rules, termed.r);
  const plan = withOffer.mandate ?? rateFor(rules, withOffer.request);
  const priced = respond(R.provider, plan, r.offers_made, offer.price_paise, withOffer.strategy);
  const move = withTerms(priced, termed.agreed, offer.price_paise, r.offers_made);
  if (move.kind === MoveKind.accept) return accept(ctx, withOffer, termsFor(ctx, withOffer, offer));
  // Its own offers used, the agent never walks away on its owner's behalf: a last offer reaches a person (ADR 0053 §4).
  if (r.offers_made >= AGENT_OFFERS) return handOver(ctx, withOffer);
  if (move.kind === MoveKind.walk) return cancel(ctx, withOffer, { reason: CancelReason.enum.no_deal });
  return quote(ctx, withOffer, move.price_paise);
}

function scopeOf(r: JobRecord): string {
  const details = Object.entries(r.request.details).map(([k, v]) => `${k}: ${v}`);
  return [r.request.need, ...details].join("; ").slice(0, SCOPE_MAX);
}

/** The worker's quote at `price`, with the terms it proposes next; `owner` when the worker sends it themselves. */
export function quote(ctx: JobContext, r: JobRecord, price: number, owner = false): Promise<JobRecord> {
  const round = r.offers_made + 1;
  const offer: Offer = {
    offer_id: `off_${ulid(ctx.clock.now().getTime())}`,
    round,
    price_paise: price,
    slot: r.request.when,
    scope: scopeOf(r),
    ...termsField(r.request.trade, nextTerms(r)),
    ...(owner ? { owner: true as const } : {}),
  };
  return ctx.send({ ...r, offers: [...r.offers, { by: R.provider, offer }], offers_made: round }, K.quote, offer);
}
