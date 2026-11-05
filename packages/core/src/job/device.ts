import {
  CancelReason,
  DEFAULT_LANG,
  type EngagementId,
  type EnvelopeKind,
  type Payment,
  Role,
  SIDE_CHANNEL_KINDS,
  type StopReason,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { ContactKeeper } from "../contacts/keeper.js";
import { apply } from "../engagement/machine.js";
import { MailTransport } from "../mail/transport.js";
import { Mentors } from "../mentor/mentors.js";
import { everyDeviceSpeaks } from "../net/reach.js";
import { PaymentBook } from "../payments/book.js";
import { WorkOffers } from "../qr/offers.js";
import { Recommendations } from "../qr/recommend.js";
import { endRestored, type RestoredEnd } from "../records/follow.js";
import { RecordsRunner } from "../records/runner.js";
import * as after from "./aftercare.js";
import { claimFor } from "./claim.js";
import * as consumer from "./consumer.js";
import type { JobContext } from "./context.js";
import * as deal from "./deal.js";
import type { DeviceOptions } from "./device-options.js";
import { dispatch, needOf } from "./dispatch.js";
import { stamped } from "./history.js";
import type { Mandate } from "./negotiate.js";
import { askWherePassed } from "./passed.js";
import { type JobRecord, JobStore, type Need, type OwnerTask, TaskKind } from "./store.js";
import { Talks } from "./talks.js";
import * as worker from "./worker.js";
import { confirm, reofferTaken } from "./worker-time.js";

/** A consumer's need before it is sent: the budget is a private mandate and never leaves the phone. */
export type NewNeed = Omit<Need, "group" | "details" | "budget"> & {
  details?: Record<string, string>;
  budget: Mandate;
};

export type { DeviceOptions } from "./device-options.js";

export class DeviceError extends Error {}

/** One phone's agent for jobs: it negotiates on the owner's behalf and asks the owner only to decide. */
export class GigDevice {
  readonly store: JobStore;
  readonly payments: PaymentBook;
  /** Mentors for someone new to a city: introductions, listings, landing requests, mentor links and their notes. */
  readonly mentors: Mentors;
  /** Offers to work through a personal QR: a worker offers, the household answers by asking (ADR 0034). */
  readonly offers: WorkOffers;
  /** A household passing on a worker it hired, and the worker being told (ADR 0055). */
  readonly recommendations: Recommendations;
  /** Sends this owner's job records to GigSync once they agreed; absent without the server's routes. */
  readonly records?: RecordsRunner;
  /** Contact details of settled jobs, removed on sync, and the problems that hold them (ADR 0039 §3). */
  readonly contacts: ContactKeeper;
  /** The owner takes a talk over from their agent, or decides a time (ADR 0053), and why an offer is what it is. */
  readonly talks: Talks;
  private readonly transport: MailTransport;
  private readonly ctx: JobContext;

  constructor(private readonly o: DeviceOptions) {
    this.store = new JobStore(o.storage);
    this.payments = new PaymentBook(o.storage, o.clock);
    this.transport = new MailTransport(o.relay, o.storage, o.keys, o.clock, o.me);
    this.ctx = {
      me: o.me,
      contact: o.contact,
      lang: o.lang ?? DEFAULT_LANG,
      autoConfirm: o.autoConfirm ?? false,
      store: this.store,
      storage: o.storage,
      payments: this.payments,
      keys: o.keys,
      clock: o.clock,
      random: o.random,
      ...(o.model ? { model: o.model } : {}),
      ...(o.estimates ? { estimates: o.estimates } : {}),
      speaks: (user, protocol) => everyDeviceSpeaks(o.relay, user, protocol),
      send: (r, kind, body) => this.send(r, kind, body),
      claim: (engagement) => claimFor(o.relay, engagement, o.me.device),
      signingKeyOf: (user, device) => this.transport.signingKeyOf(user, device),
    };
    this.mentors = new Mentors({ ctx: this.ctx, transport: this.transport, relay: o.relay }, o.mentorApi);
    this.offers = new WorkOffers({ ctx: this.ctx, transport: this.transport, isWorker: !!o.worker }, o.qrApi);
    this.recommendations = new Recommendations(this.ctx, o.qrApi);
    this.contacts = new ContactKeeper(this.ctx);
    this.talks = new Talks(this.ctx);
    if (o.records)
      this.records = new RecordsRunner(o.records, o.storage, o.clock, {
        jobs: () => this.jobs(),
        payments: () => this.payments.all(),
      });
  }

  /** Takes in what arrived, lets the agent answer it, and sends what is queued. */
  async sync(): Promise<{ received: number; sent: number }> {
    const received = await this.transport.receive();
    const { mentors, offers, contacts, recommendations } = this;
    const side = { mentors, offers, contacts, recommendations };
    // In order on purpose: each envelope may depend on the one before it.
    for (const item of received) await dispatch(this.ctx, this.o.worker, item, side);
    // A time given to one household is never signed for another (ADR 0048 §5).
    if (this.o.worker) await reofferTaken(this.ctx, this.o.worker);
    // A time that passed while nobody wrote goes to the household (ADR 0053 §2).
    await askWherePassed(this.ctx);
    await this.contacts.sweep();
    const sent = await this.transport.flush();
    await this.records?.run();
    return { received: received.length, sent };
  }

  // ── Consumer ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Sends the need to one or more workers at once; agreeing with one cancels the rest. */
  async request(n: NewNeed, workers: readonly UserId[]): Promise<JobRecord[]> {
    if (workers.length === 0) throw new DeviceError("no workers to ask");
    if (workers.includes(this.o.me.user)) throw new DeviceError("a phone cannot hire its own owner");
    const need: Need = { ...n, details: n.details ?? {}, group: `eng_${ulid(this.o.clock.now().getTime())}` };
    await this.store.saveNeed(need);
    // Each request is its own engagement with its own worker, so they can be prepared and queued together.
    return Promise.all(workers.map((w) => consumer.startRequest(this.ctx, need, w)));
  }

  async answer(id: EngagementId, answers: Record<string, string>): Promise<JobRecord> {
    const r = await this.job(id);
    return consumer.answer(this.ctx, await needOf(this.ctx, r), r, answers);
  }

  async upiLink(paymentId: string): Promise<string> {
    return after.upiLink(this.ctx, paymentId);
  }

  async markPaid(paymentId: string, utr?: string): Promise<Payment> {
    const p = await this.payments.markPaid(paymentId, utr);
    await after.sendPaymentRecord(this.ctx, await this.job(p.engagement), p);
    this.records?.soon();
    return p;
  }

  async review(id: EngagementId, review: { stars: number; text?: string }): Promise<JobRecord> {
    const r = await after.sendReview(this.ctx, await this.job(id), { stars: review.stars, text: review.text ?? "" });
    this.records?.soon();
    return r;
  }

  // ── Worker ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A progress note: a common code (`{ code: "on_my_way" }`) or the worker's own words. */
  async update(id: EngagementId, say: after.Say): Promise<JobRecord> {
    return after.sendUpdate(this.ctx, await this.job(id), say);
  }

  async deliver(id: EngagementId, say: after.Say): Promise<JobRecord> {
    return after.sendDelivery(this.ctx, await this.job(id), say);
  }

  /** Asks for what is due, with the UPI ID saved in settings; throws `PayeeMissingError` when there is none. */
  async requestPayment(id: EngagementId, note: string): Promise<Payment> {
    this.rules();
    return after.requestPayment(this.ctx, await this.provided(id), note);
  }

  /** Asks for part of the price before the work is done (ADR 0054). */
  async requestAdvance(id: EngagementId, amountPaise: number, note: string): Promise<Payment> {
    return after.requestAdvance(this.ctx, await this.provided(id), amountPaise, note);
  }

  takesAdvance = async (id: EngagementId) => after.takesAdvance(this.ctx, await this.job(id));

  /** The customer paid in cash: recorded as cash and confirmed on both phones, asking first if nobody had asked. */
  async recordCash(id: EngagementId): Promise<Payment> {
    this.rules();
    return after.recordCash(this.ctx, await this.provided(id));
  }

  /** The UPI link for the worker's own QR on an open payment, from the payee saved in settings. */
  async myUpiLink(paymentId: string): Promise<string> {
    this.rules();
    return after.myUpiLink(this.ctx, paymentId);
  }

  /** Takes a request the worker's rules said to show them first; the agent then quotes. */
  async approveRequest(id: EngagementId): Promise<JobRecord> {
    return worker.approve(this.ctx, this.rules(), await this.job(id));
  }

  /** Turns down a request the worker's rules said to show them first. */
  async declineRequest(id: EngagementId): Promise<JobRecord> {
    this.rules();
    return worker.refuse(this.ctx, await this.job(id));
  }

  async confirmPayment(paymentId: string): Promise<Payment> {
    return this.settlePayment(paymentId, (id) => this.payments.confirm(id));
  }

  async disputePayment(paymentId: string): Promise<Payment> {
    return this.settlePayment(paymentId, (id) => this.payments.dispute(id));
  }

  // ── Either side ───────────────────────────────────────────────────────────────────────────────────────────────────
  tasks(): Promise<OwnerTask[]> {
    return this.store.tasks();
  }

  async confirmDeal(id: EngagementId): Promise<JobRecord> {
    const r = await confirm(this.ctx, this.o.worker, await this.job(id));
    if (this.o.worker) await reofferTaken(this.ctx, this.o.worker);
    this.records?.soon();
    return r;
  }

  async declineDeal(id: EngagementId): Promise<JobRecord> {
    return deal.decline(this.ctx, await this.job(id));
  }

  /** Ends a job restored from the record from its own card; the record carries it to the other side (follow.ts). */
  async endRestored(id: EngagementId, end: RestoredEnd): Promise<JobRecord> {
    const r = await endRestored(this.store, await this.job(id), end, this.o.clock.now());
    this.records?.soon();
    return r;
  }

  async cancelJob(id: EngagementId, stop?: StopReason): Promise<JobRecord> {
    return deal.cancel(this.ctx, await this.job(id), { reason: CancelReason.enum.other, ...(stop ? { stop } : {}) });
  }

  jobs(): Promise<JobRecord[]> {
    return this.store.jobs();
  }

  async job(id: EngagementId): Promise<JobRecord> {
    const r = await this.store.job(id);
    if (!r) throw new DeviceError(`no job ${id}`);
    return r;
  }

  // ── Internals ─────────────────────────────────────────────────────────────────────────────────────────────────────
  private rules(): worker.WorkerRules {
    if (!this.o.worker) throw new DeviceError("only a worker's phone does this");
    return this.o.worker;
  }

  /** A job this phone does as the worker; on a job where it is the requester, it is the one who pays. */
  private async provided(id: EngagementId): Promise<JobRecord> {
    const r = await this.job(id);
    if (r.engagement.role !== Role.enum.provider) throw new DeviceError(`not the worker on ${id}`);
    return r;
  }

  private async settlePayment(paymentId: string, change: (id: string) => Promise<Payment>): Promise<Payment> {
    const p = await change(paymentId);
    await this.store.removeTask(TaskKind.confirmPayment, p.engagement);
    await after.sendPaymentRecord(this.ctx, await this.job(p.engagement), p);
    return p;
  }

  /** Applies the move first (so an impossible one throws before anything is queued), then seals and queues it. */
  private async send(r: JobRecord, kind: EnvelopeKind, body: unknown): Promise<JobRecord> {
    const now = this.o.clock.now();
    const engagement = SIDE_CHANNEL_KINDS.has(kind) ? r.engagement : apply(r.engagement, kind, now);
    await this.transport.send(r.engagement.counterpart, r.engagement.id, kind, body);
    const next = stamped({ ...r, engagement }, now.toISOString());
    await this.store.saveJob(next);
    return next;
  }
}
