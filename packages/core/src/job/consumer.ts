import {
  type Answers,
  CancelReason,
  type Clarify,
  type EngagementId,
  EngagementStatus,
  EnvelopeKind,
  type JobRequest,
  type Offer,
  Role,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import type { JobContext } from "./context.js";
import { accept, cancel, termsFor } from "./deal.js";
import { MoveKind, respond } from "./negotiate.js";
import { type JobRecord, type Need, TaskKind } from "./store.js";

const K = EnvelopeKind.enum;
const R = Role.enum;

/** Opens one engagement with one worker for the need, and sends the request. */
export async function startRequest(ctx: JobContext, need: Need, worker: UserId): Promise<JobRecord> {
  const now = ctx.clock.now();
  const at = now.toISOString();
  const id = `eng_${ulid(now.getTime())}` as EngagementId;
  const request: JobRequest = {
    trade: need.trade,
    need: need.need,
    when: need.when,
    area: need.area,
    details: need.details,
    lang: ctx.lang,
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
  };
  return ctx.send(r, K.request, request);
}

/** The worker asked questions: answer from what the owner already said, or ask the owner for the rest. */
export async function onClarify(ctx: JobContext, need: Need, job: JobRecord, body: Clarify): Promise<JobRecord> {
  const r = { ...job, questions: body.questions.map((q) => q.key) };
  const unknown = body.questions.filter((q) => !need.details[q.key]);
  if (unknown.length > 0) {
    await ctx.store.addTask(TaskKind.answerQuestions, r.engagement.id, unknown, ctx.clock.now());
    await ctx.store.saveJob(r);
    return r;
  }
  const answers = Object.fromEntries(body.questions.map((q) => [q.key, need.details[q.key] as string]));
  return ctx.send({ ...r, answers }, K.response, { answers } satisfies Answers);
}

/** The owner answered the worker's questions; the answers are kept for the other requests in the group too. */
export async function answer(ctx: JobContext, need: Need, r: JobRecord, answers: Record<string, string>) {
  await ctx.store.saveNeed({ ...need, details: { ...need.details, ...answers } });
  await ctx.store.removeTask(TaskKind.answerQuestions, r.engagement.id);
  return ctx.send({ ...r, answers: { ...r.answers, ...answers } }, K.response, { answers } satisfies Answers);
}

/** The worker quoted: accept, counter one step, or walk away when rounds run out. */
export async function onQuote(ctx: JobContext, need: Need, r: JobRecord, offer: Offer): Promise<JobRecord> {
  const withOffer = { ...r, offers: [...r.offers, { by: R.provider, offer }] };
  const move = respond(R.requester, need.budget, r.offers_made, offer.price_paise);
  if (move.kind === MoveKind.accept) return accept(ctx, withOffer, termsFor(ctx, withOffer, offer));
  if (move.kind === MoveKind.walk) return cancel(ctx, withOffer, { reason: CancelReason.enum.no_deal });
  const counter: Offer = {
    offer_id: `off_${ulid(ctx.clock.now().getTime())}`,
    round: move.round,
    price_paise: move.price_paise,
    slot: offer.slot,
    scope: offer.scope,
  };
  const next = {
    ...withOffer,
    offers: [...withOffer.offers, { by: R.requester, offer: counter }],
    offers_made: move.round,
  };
  return ctx.send(next, K.counter, counter);
}
