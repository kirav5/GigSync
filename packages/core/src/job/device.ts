import {
  CancelReason,
  type ContactCard,
  DEFAULT_LANG,
  type DeviceId,
  type EngagementId,
  type EnvelopeKind,
  type Lang,
  type Payment,
  Role,
  SIDE_CHANNEL_KINDS,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { apply } from "../engagement/machine.js";
import { MailTransport } from "../mail/transport.js";
import { Mentors } from "../mentor/mentors.js";
import type { MentorApi } from "../mentor/types.js";
import type { Relay } from "../net/api.js";
import { everyDeviceSpeaks } from "../net/reach.js";
import { PaymentBook } from "../payments/book.js";
import type { Clock, Keys, Model, Storage } from "../ports.js";
import * as after from "./aftercare.js";
import * as consumer from "./consumer.js";
import type { JobContext } from "./context.js";
import * as deal from "./deal.js";
import { dispatch, needOf } from "./dispatch.js";
import type { Mandate } from "./negotiate.js";
import { type JobRecord, JobStore, type Need, type OwnerTask, TaskKind } from "./store.js";
import * as worker from "./worker.js";

export interface DeviceOptions {
  relay: Relay;
  storage: Storage;
  keys: Keys;
  clock: Clock;
  me: { user: UserId; device: DeviceId };
  contact: ContactCard;
  /** The owner's language. Defaults to English. */
  lang?: Lang;
  /** Sign deals the agent reaches without asking. Off by default: the owner taps to sign. */
  autoConfirm?: boolean;
  /** Set on a worker's phone: what they do, where, and at what price. */
  worker?: worker.WorkerRules;
  /** The phone's model, if any: the worker's agent asks it what to ask, the household's agent what was already said. */
  model?: Model;
  /** The server's mentor routes; without them the phone can still introduce, answer and use mentor links. */
  mentorApi?: MentorApi;
}

/** A consumer's need before it is sent: the budget is a private mandate and never leaves the phone. */
export type NewNeed = Omit<Need, "group" | "details" | "budget"> & {
  details?: Record<string, string>;
  budget: Mandate;
};

export class DeviceError extends Error {}

/** One phone's agent for jobs: it negotiates on the owner's behalf and asks the owner only to decide. */
export class GigDevice {
  readonly store: JobStore;
  readonly payments: PaymentBook;
  /** Mentors for someone new to a city: introductions, listings, landing requests, mentor links and their notes. */
  readonly mentors: Mentors;
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
      ...(o.model ? { model: o.model } : {}),
      speaks: (user, protocol) => everyDeviceSpeaks(o.relay, user, protocol),
      send: (r, kind, body) => this.send(r, kind, body),
      signingKeyOf: (user, device) => this.transport.signingKeyOf(user, device),
    };
    this.mentors = new Mentors({ ctx: this.ctx, transport: this.transport, relay: o.relay }, o.mentorApi);
  }

  /** Takes in what arrived, lets the agent answer it, and sends what is queued. */
  async sync(): Promise<{ received: number; sent: number }> {
    const received = await this.transport.receive();
    // In order on purpose: each envelope may depend on the one before it.
    for (const item of received) await dispatch(this.ctx, this.o.worker, item, { mentors: this.mentors });
    return { received: received.length, sent: await this.transport.flush() };
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
    return p;
  }

  async review(id: EngagementId, review: { stars: number; text?: string }): Promise<JobRecord> {
    return after.sendReview(this.ctx, await this.job(id), { stars: review.stars, text: review.text ?? "" });
  }

  // ── Worker ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A progress note: a common code (`{ code: "on_my_way" }`) or the worker's own words. */
  async update(id: EngagementId, say: after.Say): Promise<JobRecord> {
    return after.sendUpdate(this.ctx, await this.job(id), say);
  }

  async deliver(id: EngagementId, say: after.Say): Promise<JobRecord> {
    return after.sendDelivery(this.ctx, await this.job(id), say);
  }

  /** Asks for the signed price, with the UPI ID saved in settings; throws `PayeeMissingError` when there is none. */
  async requestPayment(id: EngagementId, note: string): Promise<Payment> {
    this.rules();
    return after.requestPayment(this.ctx, await this.provided(id), note);
  }

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
    return deal.sign(this.ctx, await this.job(id));
  }

  async declineDeal(id: EngagementId): Promise<JobRecord> {
    return deal.decline(this.ctx, await this.job(id));
  }

  async cancelJob(id: EngagementId, note?: string): Promise<JobRecord> {
    return deal.cancel(this.ctx, await this.job(id), { reason: CancelReason.enum.other, ...(note ? { note } : {}) });
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
    const engagement = SIDE_CHANNEL_KINDS.has(kind) ? r.engagement : apply(r.engagement, kind, this.o.clock.now());
    await this.transport.send(r.engagement.counterpart, r.engagement.id, kind, body);
    const next = { ...r, engagement };
    await this.store.saveJob(next);
    return next;
  }
}
