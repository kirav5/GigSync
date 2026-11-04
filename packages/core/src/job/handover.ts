import {
  EnvelopeKind,
  MAX_ROUNDS,
  type Offer,
  OWNER_OFFERS_PROTOCOL,
  ROUNDS_BEFORE_OWNERS,
  Role,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import type { JobContext } from "./context.js";
import { type JobRecord, TaskKind } from "./store.js";
import { AGENT_OFFERS } from "./strategy.js";
import { nextTerms, type TimeAsk, termsField } from "./terms-flow.js";

/**
 * When the agents stop and the people decide (ADR 0053 §3–4). An agent makes at most `AGENT_OFFERS` offers of its own;
 * if they have not agreed by then, the job waits for both owners. The one whose turn it is may accept the other side's
 * last offer, send offers of their own up to `MAX_ROUNDS` a side (to a phone that takes them), or end the talk; the
 * other may accept the other side's last offer while it stands, or end it. A time the household did not ask for, or one
 * that has passed, always waits for the household.
 */

const K = EnvelopeKind.enum;
const R = Role.enum;

export class HandOverError extends Error {}

export { AGENT_OFFERS };

/** A take-over task: `waiting` when the other side's owner has the turn, and this one may only take their offer. */
export interface TakeOver {
  waiting?: true;
}

/** The offers this side may make on the job in all: past `ROUNDS_BEFORE_OWNERS` only to a phone that takes them. */
export const roundsOf = (r: JobRecord): number => r.rounds ?? ROUNDS_BEFORE_OWNERS;

/** The job with the offers the other side's phone takes, asked once, when the owners are about to take over. */
async function withRounds(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  if (r.rounds !== undefined) return r;
  const more = await ctx.speaks(r.engagement.counterpart, OWNER_OFFERS_PROTOCOL);
  return { ...r, rounds: more ? MAX_ROUNDS : ROUNDS_BEFORE_OWNERS };
}

/** The agent has used its offers: the job is kept as it stands and waits for its owner. */
export async function handOver(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  const kept = await withRounds(ctx, r);
  await ctx.store.saveJob(kept);
  const task: TakeOver = {};
  await ctx.store.addTask(TaskKind.takeOver, kept.engagement.id, task, ctx.clock.now());
  return kept;
}

/**
 * After its agent's last offer answers the other agent's last, this owner is told too (ADR 0053 §4): both agents are
 * out of offers, so the other side's owner decides next, and this one may still take their last offer.
 */
export async function afterAgentOffer(ctx: JobContext, sent: JobRecord, theirs: Offer): Promise<JobRecord> {
  if (sent.offers_made < AGENT_OFFERS || theirs.round < AGENT_OFFERS) return sent;
  const kept = await withRounds(ctx, sent);
  await ctx.store.saveJob(kept);
  const task: TakeOver = { waiting: true };
  await ctx.store.addTask(TaskKind.takeOver, kept.engagement.id, task, ctx.clock.now());
  return kept;
}

/** The household's owner decides the time: the worker's other one, or a new one for a time that has passed. */
export async function askTime(ctx: JobContext, r: JobRecord, time: TimeAsk): Promise<JobRecord> {
  await ctx.store.saveJob(r);
  await ctx.store.addTask(TaskKind.newTime, r.engagement.id, time, ctx.clock.now());
  return r;
}

/** Every owner decision about the talk, gone once the owner acts or the job ends. */
export async function clearTalkTasks(ctx: JobContext, r: JobRecord): Promise<void> {
  await ctx.store.removeTask(TaskKind.takeOver, r.engagement.id);
  await ctx.store.removeTask(TaskKind.newTime, r.engagement.id);
}

/**
 * The household's counter at `price`, with the terms it proposes next, answering the worker's last quote; `owner` when
 * the household's owner sends it themselves.
 */
export function counter(ctx: JobContext, r: JobRecord, price: number, owner = false): Promise<JobRecord> {
  const quote = r.offers.filter((o) => o.by === R.provider).at(-1)?.offer;
  if (!quote) throw new HandOverError("no quote to answer");
  const round = r.offers_made + 1;
  const offer: Offer = {
    offer_id: `off_${ulid(ctx.clock.now().getTime())}`,
    round,
    price_paise: price,
    slot: quote.slot,
    scope: quote.scope,
    ...termsField(r.request.trade, nextTerms(r)),
  };
  const sent = { by: R.requester, offer, ...(owner ? { owner: true as const } : {}) };
  return ctx.send({ ...r, offers: [...r.offers, sent], offers_made: round }, K.counter, offer);
}
