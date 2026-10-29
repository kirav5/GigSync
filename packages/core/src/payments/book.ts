import {
  type Engagement,
  type EngagementId,
  EngagementStatus,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  Role,
  type UserId,
  Utr,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { type Clock, Collection, type Storage } from "../ports.js";

export class PaymentError extends Error {}

const S = PaymentStatus.enum;
const E = EngagementStatus.enum;

/** A worker can ask to be paid once the job is agreed, and until it has been closed. */
const PAYABLE: ReadonlySet<Engagement["status"]> = new Set([E.agreed, E.in_progress, E.delivered, E.closed]);

/** Payment requests come from the worker's side of the engagement. */
export function canRequestPayment(e: Engagement): boolean {
  return e.role === Role.enum.provider && PAYABLE.has(e.status);
}

/** Asked for, or marked paid, and not yet settled: while one is open on a job, the worker does not ask again. */
export const OPEN_PAYMENT: ReadonlySet<PaymentStatus> = new Set([S.requested, S.paid]);

/** Which statuses each change may start from. */
const FROM: Readonly<Record<"paid" | "confirmed" | "disputed", ReadonlySet<PaymentStatus>>> = {
  paid: new Set([S.requested]),
  confirmed: new Set([S.requested, S.paid]),
  disputed: new Set([S.requested, S.paid]),
};

export interface PaymentSummary {
  requested: number;
  paid: number;
  confirmed: number;
  /** Requested or claimed paid, but not yet confirmed by the worker. Disputed payments are not counted. */
  outstanding: number;
}

/** Totals over any set of payments; disputed payments count nowhere. */
export function summarize(payments: readonly Payment[]): PaymentSummary {
  const sum = { requested: 0, paid: 0, confirmed: 0, outstanding: 0 };
  for (const p of payments) {
    if (p.status === S.disputed) continue;
    sum.requested += p.amount_paise;
    if (p.status === S.paid || p.status === S.confirmed) sum.paid += p.amount_paise;
    if (p.status === S.confirmed) sum.confirmed += p.amount_paise;
    else sum.outstanding += p.amount_paise;
  }
  return sum;
}

/** The payments of every job, kept on this phone. Each change is a pure transition, then saved. */
export class PaymentBook {
  constructor(
    private readonly storage: Storage,
    private readonly clock: Clock,
  ) {}

  /** The worker asks for payment for a job. Their UPI ID is not stored here; it is added only to the QR or request. */
  async request(input: {
    engagement: Engagement;
    payee: UserId;
    amountPaise: number;
    note: string;
    method?: PaymentMethod;
  }): Promise<Payment> {
    if (!canRequestPayment(input.engagement)) throw new PaymentError("this job cannot be paid for yet");
    const now = this.clock.now();
    const payment: Payment = {
      id: `pay_${ulid(now.getTime())}`,
      engagement: input.engagement.id,
      payee: input.payee,
      payer: input.engagement.counterpart,
      amount_paise: input.amountPaise,
      method: input.method ?? PaymentMethod.enum.upi,
      status: S.requested,
      note: input.note,
      requested_at: now.toISOString(),
    };
    await this.save(payment);
    return payment;
  }

  /** Either side records that the money was sent; the UPI reference is optional, and cash has none. */
  async markPaid(id: string, utr?: string): Promise<Payment> {
    if (utr !== undefined && !Utr.safeParse(utr).success) throw new PaymentError("UPI reference must be 12 digits");
    return this.change(id, S.paid, (p, at) => ({ ...p, paid_at: at, ...(utr ? { utr } : {}) }));
  }

  /** The worker confirms the money reached them. */
  confirm(id: string): Promise<Payment> {
    return this.change(id, S.confirmed, (p, at) => ({ ...p, confirmed_at: at, paid_at: p.paid_at ?? at }));
  }

  /**
   * The worker took the money in cash: the payment becomes a cash payment, received now. A UPI reference the customer
   * may have typed is dropped, since no UPI transfer is what settled it.
   */
  confirmCash(id: string): Promise<Payment> {
    return this.change(id, S.confirmed, ({ utr: _utr, ...p }, at) => ({
      ...p,
      method: PaymentMethod.enum.cash,
      paid_at: p.paid_at ?? at,
      confirmed_at: at,
    }));
  }

  /** The worker says the money did not arrive, or was wrong. */
  dispute(id: string): Promise<Payment> {
    return this.change(id, S.disputed, (p, at) => ({ ...p, disputed_at: at }));
  }

  /**
   * A payment the other side sent, from `from`; it replaces ours only if it moves the status forward and the sender
   * may make that move: only the payer says "paid", only the payee (the worker) says "confirmed" or "disputed", and
   * only the payee turns a payment into cash, together with confirming it. A new payment is taken only as the payee's
   * request.
   */
  async receive(theirs: Payment, from: UserId): Promise<Payment> {
    const ours = await this.storage.get<Payment>(Collection.payments, theirs.id);
    const byPayee = from === theirs.payee;
    if (!ours) {
      if (!byPayee || theirs.status !== S.requested) throw new PaymentError(`unexpected new payment ${theirs.id}`);
      await this.save(theirs);
      return theirs;
    }
    if (theirs.payee !== ours.payee || theirs.payer !== ours.payer) return ours;
    if (theirs.status === S.paid && from === ours.payer && FROM.paid.has(ours.status))
      return this.markPaid(ours.id, theirs.utr);
    if (theirs.status === S.confirmed && byPayee && FROM.confirmed.has(ours.status))
      return theirs.method === PaymentMethod.enum.cash ? this.confirmCash(ours.id) : this.confirm(ours.id);
    if (theirs.status === S.disputed && byPayee && FROM.disputed.has(ours.status)) return this.dispute(ours.id);
    return ours;
  }

  get(id: string): Promise<Payment | undefined> {
    return this.storage.get<Payment>(Collection.payments, id);
  }

  async forEngagement(engagement: EngagementId): Promise<Payment[]> {
    const all = await this.storage.list<Payment>(Collection.payments);
    return all
      .filter((p) => p.engagement === engagement)
      .sort((a, b) => (a.requested_at ?? "").localeCompare(b.requested_at ?? ""));
  }

  async summary(engagement: EngagementId): Promise<PaymentSummary> {
    return summarize(await this.forEngagement(engagement));
  }

  /** Every payment on this phone, newest first: the worker's whole record. */
  async all(): Promise<Payment[]> {
    const all = await this.storage.list<Payment>(Collection.payments);
    return all.sort((a, b) => (b.requested_at ?? "").localeCompare(a.requested_at ?? ""));
  }

  private async change(
    id: string,
    to: keyof typeof FROM,
    update: (p: Payment, at: string) => Payment,
  ): Promise<Payment> {
    const current = await this.get(id);
    if (!current) throw new PaymentError(`no payment ${id}`);
    if (!FROM[to].has(current.status))
      throw new PaymentError(`payment ${id}: ${to} is not allowed from ${current.status}`);
    const next = { ...update(current, this.clock.now().toISOString()), status: S[to] };
    await this.save(next);
    return next;
  }

  private save(p: Payment): Promise<void> {
    return this.storage.put(Collection.payments, p.id, p);
  }
}
