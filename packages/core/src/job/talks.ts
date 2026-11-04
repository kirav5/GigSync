import {
  CancelReason,
  type EngagementId,
  type Lang,
  type Offer,
  Paise,
  Role,
  Terms,
  type TermWhen,
} from "@gigsync/protocol";
import { whenPassed } from "../schedule/windows.js";
import { onQuote } from "./consumer.js";
import type { JobContext } from "./context.js";
import { accept, cancel, termsFor } from "./deal.js";
import { offerFacts } from "./explain.js";
import { type Explanation, explainOffer } from "./explain-model.js";
import { askTime, clearTalkTasks, counter, roundsOf, type TakeOver, waitOnThem, withRounds } from "./handover.js";
import { withHours } from "./hours-gate.js";
import { planHousehold } from "./household-plan.js";
import { MoveKind, respond } from "./negotiate.js";
import { type JobRecord, type Need, TaskKind } from "./store.js";
import { nextTerms } from "./terms-flow.js";
import { quote } from "./worker.js";

/**
 * The owner takes the talk over from their agent (ADR 0053 §3–5), whether it handed the job over or is still talking:
 * accept the other side's last offer, send an offer of their own, or end it; and, for a household, decide a time the
 * worker proposed or pick another. Each answers the other side's last word, so it is offered only while that is theirs;
 * once both agents are out of offers, the owner waiting on the other may still take that side's latest offer.
 */

const R = Role.enum;
const PASSED = "that time has passed";

export class TalkError extends Error {}

/** The other side's offer, when the last word in the talk is theirs. */
export function theirLast(r: JobRecord): Offer | undefined {
  const last = r.offers.at(-1);
  return last && last.by !== r.engagement.role ? last.offer : undefined;
}

/** The other side's latest offer, whoever spoke last: what a waiting owner may still take (ADR 0053 §4). */
export function theirLatest(r: JobRecord): Offer | undefined {
  return r.offers.filter((o) => o.by !== r.engagement.role).at(-1)?.offer;
}

/** The owner may still send an offer of their own: the other side spoke last and the other phone takes one more. */
export const canOffer = (r: JobRecord): boolean => theirLast(r) !== undefined && r.offers_made < roundsOf(r);

export class Talks {
  constructor(private readonly ctx: JobContext) {}

  /**
   * Accepts the other side's last offer as it stands: price and terms, to sign as any deal. Never at a time that has
   * passed: the household is asked for a new one instead (ADR 0053 §2).
   */
  async acceptTheirs(id: EngagementId): Promise<JobRecord> {
    const r = await this.job(id);
    const last = theirLast(r);
    const offer = last ?? ((await this.waiting(id)) ? theirLatest(r) : undefined);
    if (!offer) throw new TalkError("nothing of theirs to accept");
    const when = offer.terms?.when;
    if (when && whenPassed(when, this.ctx.clock.now())) {
      // Only a household whose turn it is picks a new time; one waiting on the worker leaves it to him.
      if (r.engagement.role !== R.requester || !last) throw new TalkError(PASSED);
      await clearTalkTasks(this.ctx, r);
      return askTime(this.ctx, r, { passed: true });
    }
    await clearTalkTasks(this.ctx, r);
    return accept(this.ctx, r, termsFor(this.ctx, r, offer));
  }

  /** Sends the owner's own offer at `price` (paise), with the terms their agent proposes. */
  async offer(id: EngagementId, price: number): Promise<JobRecord> {
    if (!Paise.safeParse(price).success) throw new TalkError("price out of range");
    const found = await withRounds(this.ctx, await this.job(id));
    if (!canOffer(found)) throw new TalkError("not this side's turn, or no offers left");
    const r = await this.moveOn(found);
    const sent =
      r.engagement.role === R.requester
        ? await counter(this.ctx, r, price, true)
        : await quote(this.ctx, r, price, true);
    return waitOnThem(this.ctx, sent);
  }

  /** Ends the talk: no deal, on both phones. */
  async end(id: EngagementId): Promise<JobRecord> {
    const r = await this.job(id);
    await clearTalkTasks(this.ctx, r);
    return cancel(this.ctx, r, { reason: CancelReason.enum.no_deal });
  }

  /** The household takes the time the worker proposed; its agent then answers that offer as it would any other. */
  async acceptTime(id: EngagementId): Promise<JobRecord> {
    const { r, need, offer } = await this.householdTurn(id);
    const when = offer.terms?.when;
    if (!when) throw new TalkError("no time proposed");
    if (whenPassed(when, this.ctx.clock.now())) throw new TalkError(PASSED);
    await clearTalkTasks(this.ctx, r);
    const time = withHours({ when }, r.terms?.hours).when ?? when;
    return onQuote(this.ctx, need, { ...r, time, offers: r.offers.slice(0, -1) }, offer);
  }

  /** The household picks a time of its own: sent to the worker with its agent's next price. */
  async pickTime(id: EngagementId, when: TermWhen): Promise<JobRecord> {
    const turn = await this.householdTurn(id);
    const { need, offer } = turn;
    const r = await withRounds(this.ctx, turn.r);
    if (whenPassed(when, this.ctx.clock.now())) throw new TalkError(PASSED);
    if (r.offers_made >= roundsOf(r)) throw new TalkError("no offers left");
    const moved = await this.moveOn(r);
    const planned = await planHousehold(this.ctx, need, { ...moved, time: when });
    const move = respond(
      R.requester,
      planned.mandate ?? need.budget,
      r.offers_made,
      offer.price_paise,
      planned.strategy,
    );
    const price = move.kind === MoveKind.offer ? move.price_paise : offer.price_paise;
    const next = withHours(Terms.parse({ ...nextTerms(planned), when }), planned.terms?.hours);
    return waitOnThem(
      this.ctx,
      await counter(
        this.ctx,
        { ...planned, terms: { on: true, next, hours: planned.terms?.hours === true } },
        price,
        true,
      ),
    );
  }

  /**
   * Why the offer at `index` of a job is what it is, for this owner in `lang` (ADR 0033 §4): worded by the phone's
   * model when its numbers all check out, else the template. Their own limit is in it; it is never sent.
   */
  async explain(id: EngagementId, index: number, name: string, lang: Lang): Promise<Explanation> {
    const r = await this.job(id);
    const limit =
      r.engagement.role === R.requester
        ? (await this.ctx.store.need(r.engagement.group))?.budget.limit_paise
        : r.mandate?.limit_paise;
    return explainOffer(this.ctx.model, { facts: offerFacts(r, index, limit), lang, name });
  }

  /**
   * The owner moves the talk on with an offer of their own: every decision about it is gone, and so is a deal their
   * agent reached meanwhile, which is no longer theirs to sign.
   */
  private async moveOn(r: JobRecord): Promise<JobRecord> {
    await clearTalkTasks(this.ctx, r);
    await this.ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
    return { ...r, pending: undefined };
  }

  /** Both agents are out of offers and the other side's owner has the turn. */
  private async waiting(id: EngagementId): Promise<boolean> {
    const task = await this.ctx.store.task(TaskKind.takeOver, id);
    return (task?.detail as TakeOver | undefined)?.waiting === true;
  }

  private async job(id: EngagementId): Promise<JobRecord> {
    const r = await this.ctx.store.job(id);
    if (!r) throw new TalkError(`no job ${id}`);
    return r;
  }

  /** A household's job whose last word is the worker's quote, with its need. */
  private async householdTurn(id: EngagementId): Promise<{ r: JobRecord; need: Need; offer: Offer }> {
    const r = await this.job(id);
    const offer = theirLast(r);
    const need = await this.ctx.store.need(r.engagement.group);
    if (r.engagement.role !== R.requester || !offer || !need) throw new TalkError("not a household's turn");
    return { r, need, offer };
  }
}
