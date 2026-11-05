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

/**
 * The job with the offers the other side's phone takes, asked once the talk reaches the owners. A directory that does
 * not answer leaves it unknown, to ask again later: the cap stays at `ROUNDS_BEFORE_OWNERS` meanwhile, and the owner's
 * decision is never lost to it.
 */
export async function withRounds(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  if (r.rounds !== undefined || r.offers_made < AGENT_OFFERS) return r;
  try {
    const more = await ctx.speaks(r.engagement.counterpart, OWNER_OFFERS_PROTOCOL);
    return { ...r, rounds: more ? MAX_ROUNDS : ROUNDS_BEFORE_OWNERS };
  } catch {
    return r;
  }
}

/** Saves the job and gives its owner the take-over task: to decide, or (`waiting`) to wait on the other owner. */
async function takeOver(ctx: JobContext, r: JobRecord, task: TakeOver): Promise<JobRecord> {
  const kept = await withRounds(ctx, r);
  await ctx.store.saveJob(kept);
  await ctx.store.addTask(TaskKind.takeOver, kept.engagement.id, task, ctx.clock.now());
  return kept;
}

/** The agent has used its offers: the job is kept as it stands and waits for its owner. */
export const handOver = (ctx: JobContext, r: JobRecord): Promise<JobRecord> => takeOver(ctx, r, {});

/**
 * This side's last word is past its agent's offers, and the other side's owner decides next (ADR 0053 §4): this owner
 * is told, and may still take the other side's latest offer. After its agent's last offer answers the other agent's
 * last, or after an offer of the owner's own.
 */
export async function waitOnThem(ctx: JobContext, sent: JobRecord): Promise<JobRecord> {
  const theirs = sent.offers.filter((o) => o.by !== sent.engagement.role).at(-1)?.offer;
  if (sent.offers_made < AGENT_OFFERS || !theirs || theirs.round < AGENT_OFFERS) return sent;
  return takeOver(ctx, sent, { waiting: true });
}

/** The household's owner decides the time: the worker's other one, or a new one for a time that has passed. */
export async function askTime(ctx: JobContext, r: JobRecord, time: TimeAsk): Promise<JobRecord> {
  const kept = await withRounds(ctx, r);
  await ctx.store.saveJob(kept);
  await ctx.store.addTask(TaskKind.newTime, kept.engagement.id, time, ctx.clock.now());
  return kept;
}

/**
 * Before this side's agent answers a new offer from the other: every decision about the talk is gone, and so is a deal
 * the agent reached that the owner has not signed, since the talk moved on past it.
 */
export async function answering(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  await clearTalkTasks(ctx, r);
  if (!r.pending || r.mine) return r;
  await ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
  return { ...r, pending: undefined };
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
    ...(owner ? { owner: true as const } : {}),
  };
  return ctx.send({ ...r, offers: [...r.offers, { by: R.requester, offer }], offers_made: round }, K.counter, offer);
}
