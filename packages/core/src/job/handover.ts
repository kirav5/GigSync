import { EnvelopeKind, type Offer, Role } from "@gigsync/protocol";
import { ulid } from "ulid";
import type { JobContext } from "./context.js";
import { type JobRecord, TaskKind } from "./store.js";
import { nextTerms, type TimeAsk, termsField } from "./terms-flow.js";

/**
 * When the agents stop and the people decide (ADR 0053 §3–4). An agent makes at most `AGENT_OFFERS` offers of its own;
 * if they have not agreed by then, the job waits for its owner, who may accept the other side's last offer, send one
 * of their own (the protocol allows `MAX_ROUNDS` a side), or end the talk. A time the household did not ask for, or
 * one that has passed, always waits for the household.
 */

const K = EnvelopeKind.enum;
const R = Role.enum;

export class HandOverError extends Error {}

export { AGENT_OFFERS } from "./strategy.js";

/** The agent has used its offers: the job is kept as it stands and waits for its owner. */
export async function handOver(ctx: JobContext, r: JobRecord): Promise<JobRecord> {
  await ctx.store.saveJob(r);
  await ctx.store.addTask(TaskKind.takeOver, r.engagement.id, {}, ctx.clock.now());
  return r;
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

/** The household's counter at `price`, with the terms it proposes next, answering the worker's last quote. */
export function counter(ctx: JobContext, r: JobRecord, price: number): Promise<JobRecord> {
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
  return ctx.send({ ...r, offers: [...r.offers, { by: R.requester, offer }], offers_made: round }, K.counter, offer);
}
