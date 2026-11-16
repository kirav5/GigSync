import {
  type Answers,
  CancelReason,
  type Clarify,
  coarsePoint,
  type EngagementId,
  EngagementStatus,
  EnvelopeKind,
  type JobRequest,
  type Offer,
  QuestionKey,
  Role,
  SKIPPED,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { answersFound } from "./answer.js";
import type { JobContext } from "./context.js";
import { accept, cancel, termsFor } from "./deal.js";
import { AGENT_OFFERS, answering, askTime, counter, handOver, waitOnThem } from "./handover.js";
import { speaksHours } from "./hours-gate.js";
import { planHousehold } from "./household-plan.js";
import { MoveKind, respond } from "./negotiate.js";
import { AnswerSource, type JobRecord, type Need, type Suggested, TaskKind } from "./store.js";
import { householdTerms, requestTerms, speaksTerms, withTerms } from "./terms-flow.js";

const K = EnvelopeKind.enum;
const R = Role.enum;

/** Opens one engagement with one worker for the need, and sends the request. */
export async function startRequest(ctx: JobContext, need: Need, worker: UserId): Promise<JobRecord> {
  const now = ctx.clock.now();
  const at = now.toISOString();
  const id = `eng_${ulid(now.getTime())}` as EngagementId;
  const [terms, hours] = await Promise.all([speaksTerms(ctx, worker), speaksHours(ctx, worker)]);
  const request: JobRequest = {
    trade: need.trade,
    ...(need.skill ? { skill: need.skill } : {}),
    need: need.need,
    when: need.when,
    area: coarsePoint(need.area),
    ...(need.locality ? { locality: need.locality } : {}),
    details: need.details,
    lang: ctx.lang,
    ...requestTerms(need, terms, hours),
    ...(need.photos?.length ? { photos: need.photos } : {}),
  };
  const r: JobRecord = {
    engagement: {
      id,
      group: need.group,
      role: R.requester,
      counterpart: worker,
      status: EngagementStatus.enum.draft,
      brief: { text: need.need, topic: need.trade, shared: need.details },
      created_at: at,
      updated_at: at,
    },
    request,
    offers: [],
    offers_made: 0,
    asked: false,
    ...(need.estimate ? { estimate: need.estimate } : {}),
    terms: { on: terms, hours },
  };
  return ctx.send(r, K.request, request);
}

/**
 * The worker asked questions: the agent answers what its owner already said (this need's words, or a past job's
 * stable facts when the owner lets it) and asks the owner the rest, with any remembered answer filled in for them to
 * send, change or skip. Nothing is sent until every question has an answer.
 */
export async function onClarify(ctx: JobContext, need: Need, job: JobRecord, body: Clarify): Promise<JobRecord> {
  const { found, suggested } = await answersFound(ctx, need, body.questions);
  const { suggested: _before, ...rest } = job;
  const r: JobRecord = {
    ...rest,
    questions: body.questions,
    answers: { ...job.answers, ...mapValues(found, (f) => f.text) },
    answered_from: { ...job.answered_from, ...mapValues(found, (f) => f.source) },
    ...(Object.keys(suggested).length > 0 ? { suggested } : {}),
  };
  const open = body.questions.filter((q) => found[q.key] === undefined);
  if (open.length > 0) {
    await ctx.store.addTask(TaskKind.answerQuestions, r.engagement.id, open, ctx.clock.now());
    await ctx.store.saveJob(r);
    return r;
  }
  return ctx.send(r, K.response, { answers: r.answers ?? {} } satisfies Answers);
}

/**
 * The owner answered the rest (or skipped them); everything goes to the worker together. Answers to standard
 * questions are kept for the other requests in the group too; answers to a model's questions are not, since another
 * worker's agent may use the same key for a different question.
 */
export async function answer(ctx: JobContext, need: Need, r: JobRecord, given: Record<string, string>) {
  const typed = mapValues(given, (text) => text.trim() || SKIPPED);
  const reusable = Object.entries(typed).filter(
    ([key, text]) => QuestionKey.safeParse(key).success && text !== SKIPPED,
  );
  await ctx.store.saveNeed({ ...need, details: { ...need.details, ...Object.fromEntries(reusable) } });
  await ctx.store.removeTask(TaskKind.answerQuestions, r.engagement.id);
  const answers = { ...r.answers, ...typed };
  const answered_from = { ...r.answered_from, ...sourcesOf(typed, r.suggested ?? {}) };
  const { suggested: _sent, ...rest } = r;
  return ctx.send({ ...rest, answers, answered_from }, K.response, { answers } satisfies Answers);
}

/** A remembered answer sent as it was filled in is still the past job's; one the owner changed is theirs. */
const sourcesOf = (typed: Record<string, string>, suggested: Record<string, Suggested>) =>
  Object.fromEntries(
    Object.entries(typed).map(([key, text]) => [
      key,
      suggested[key]?.text === text ? AnswerSource.memory : AnswerSource.owner,
    ]),
  );

const mapValues = <T, U>(o: Readonly<Record<string, T>>, f: (v: T) => U): Record<string, U> =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

/**
 * The worker quoted: accept, or counter one step. A time the household did not ask for, or one that has passed, waits
 * for its owner; so does a talk its agent has made its offers in (ADR 0053 §3–4).
 */
export async function onQuote(ctx: JobContext, need: Need, found: JobRecord, offer: Offer): Promise<JobRecord> {
  const r = await answering(ctx, found);
  const planned = await planHousehold(ctx, need, r);
  const quoted = { ...planned, offers: [...r.offers, { by: R.provider, offer }] };
  const termed = await householdTerms(ctx, need, quoted, offer.terms);
  const withOffer = termed.r;
  if (termed.time) return askTime(ctx, withOffer, termed.time);
  const plan = planned.mandate ?? need.budget;
  const priced = respond(R.requester, plan, r.offers_made, offer.price_paise, planned.strategy);
  const move = withTerms(priced, termed.agreed, offer.price_paise, r.offers_made);
  if (move.kind === MoveKind.accept) return accept(ctx, withOffer, termsFor(ctx, withOffer, offer));
  // Its own offers used, the agent never walks away on its owner's behalf: a last offer reaches a person (ADR 0053 §4).
  if (r.offers_made >= AGENT_OFFERS) return handOver(ctx, withOffer);
  if (move.kind === MoveKind.walk) return cancel(ctx, withOffer, { reason: CancelReason.enum.no_deal });
  return waitOnThem(ctx, await counter(ctx, withOffer, move.price_paise));
}
