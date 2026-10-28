import {
  type Answers,
  CancelReason,
  type Clarify,
  EnvelopeKind,
  type Offer,
  type Place,
  QuestionKey,
  type RateCard,
  Role,
  SCOPE_MAX,
  Trade,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { pastPrices, proposeMandate } from "./advice.js";
import type { JobContext } from "./context.js";
import { accept, cancel, termsFor } from "./deal.js";
import { present } from "./details.js";
import { type Mandate, MoveKind, priceAt, respond } from "./negotiate.js";
import { type JobRecord, TaskKind } from "./store.js";

const K = EnvelopeKind.enum;
const T = Trade.enum;
const R = Role.enum;

/** A worker's private rules: what they do, where, and at what price. Only the public part is on the board. */
export interface WorkerRules {
  trades: Trade[];
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
  radius_km: number;
  /**
   * Their UPI ID and the name payers see. Leaving the card for the payee store in settings (`payments/payee.ts`), which
   * payment requests will read at send time; optional until then.
   */
  vpa?: string;
  payee_name?: string;
}

const Q = QuestionKey.enum;

/**
 * What the worker's agent asks before quoting, per trade, unless the consumer already said. Keys only: each phone
 * shows them in its owner's language (`questionText`).
 */
export const QUESTIONS: Readonly<Record<Trade, readonly QuestionKey[]>> = {
  [T.electrician]: [Q.problem],
  [T.plumber]: [Q.problem],
  [T.maid]: [Q.rooms, Q.pets],
  [T.carpenter]: [Q.problem],
  [T.ac_technician]: [Q.problem],
  [T.painter]: [Q.area_sqft],
  [T.cook]: [Q.people, Q.meals, Q.pets],
  [T.driver]: [Q.route],
};

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;
export function distanceKm(a: Place, b: Place): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** A new request: decline what this worker does not do, ask what is missing, otherwise quote. */
export async function onRequest(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  const req = r.request;
  if (!rules.trades.includes(req.trade) || distanceKm(rules.base, req.area) > rules.radius_km)
    return cancel(ctx, r, { reason: CancelReason.enum.no_match });
  const missing = QUESTIONS[req.trade].filter((key) => !req.details[key]).map((key) => ({ key }));
  if (missing.length > 0 && !r.asked)
    return ctx.send({ ...r, asked: true }, K.clarify, { questions: missing } satisfies Clarify);
  return quoteNext(ctx, rules, r);
}

export function onAnswers(ctx: JobContext, rules: WorkerRules, r: JobRecord, body: Answers): Promise<JobRecord> {
  const request = { ...r.request, details: { ...r.request.details, ...body.answers } };
  return quoteNext(ctx, rules, { ...r, request });
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

/** This job's plan: from the city's band for the trade when there is one, else the worker's own rate. */
async function planFor(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  if (r.mandate) return r;
  const band = rules.rates?.bands.find((b) => b.trade === r.request.trade);
  if (!band) return { ...r, mandate: rules.rate };
  const history = pastPrices(await ctx.store.jobs(), r.request.trade);
  const advice = proposeMandate({ band, details: r.request.details, history, floor_paise: rules.rate.limit_paise });
  return { ...r, mandate: advice.mandate, advice };
}

/** Plans the job, shows it to the worker first if a flagged detail is present, otherwise makes the next offer. */
async function quoteNext(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<JobRecord> {
  const planned = await planFor(ctx, rules, r);
  const flagged = (rules.ask_me ?? []).filter((key) => present(planned.request.details[key]));
  if (flagged.length > 0 && !planned.owner_ok) {
    const detail = { flagged, mandate: planned.mandate, advice: planned.advice };
    await ctx.store.addTask(TaskKind.approveRequest, planned.engagement.id, detail, ctx.clock.now());
    await ctx.store.saveJob(planned);
    return planned;
  }
  return quote(ctx, planned, priceAt(R.provider, planned.mandate ?? rules.rate, planned.offers_made + 1));
}

/** The consumer countered: accept, concede one step, or walk away when rounds run out. */
export async function onCounter(ctx: JobContext, rules: WorkerRules, r: JobRecord, offer: Offer): Promise<JobRecord> {
  const withOffer = { ...r, offers: [...r.offers, { by: R.requester, offer }] };
  const move = respond(R.provider, r.mandate ?? rules.rate, r.offers_made, offer.price_paise);
  if (move.kind === MoveKind.accept) return accept(ctx, withOffer, termsFor(ctx, withOffer, offer));
  if (move.kind === MoveKind.walk) return cancel(ctx, withOffer, { reason: CancelReason.enum.no_deal });
  return quote(ctx, withOffer, move.price_paise);
}

function scopeOf(r: JobRecord): string {
  const details = Object.entries(r.request.details).map(([k, v]) => `${k}: ${v}`);
  return [r.request.need, ...details].join("; ").slice(0, SCOPE_MAX);
}

function quote(ctx: JobContext, r: JobRecord, price: number): Promise<JobRecord> {
  const round = r.offers_made + 1;
  const offer: Offer = {
    offer_id: `off_${ulid(ctx.clock.now().getTime())}`,
    round,
    price_paise: price,
    slot: r.request.when,
    scope: scopeOf(r),
  };
  return ctx.send({ ...r, offers: [...r.offers, { by: R.provider, offer }], offers_made: round }, K.quote, offer);
}
