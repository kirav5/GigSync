import {
  type BoardProfile,
  type EngagementId,
  EnvelopeKind,
  OFFERS_PER_WORKER_DAY,
  OfferRefusal,
  type QrCode,
  type UserId,
  WORK_OFFER_PROTOCOL,
  type WorkerRecord,
  type WorkOffer,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { shownRecord, withoutRecord } from "../job/card-record.js";
import type { JobContext } from "../job/context.js";
import { log } from "../log.js";
import type { MailTransport, Received } from "../mail/transport.js";
import { MentorStore } from "../mentor/store.js";
import { QrError, QrProblem, qrProblemOf } from "./errors.js";
import { OfferStore } from "./store.js";
import { OfferState, type QrApi, type ReceivedOffer } from "./types.js";

/** An offer is counted toward the day's limits for this long after it was sent. */
const DAY_MS = 24 * 60 * 60_000;
/** An open offer the household has not answered is shown for a week, then dropped from view. */
const OFFER_SHOWN_MS = 7 * DAY_MS;
/** At most this many open offers are kept: a stream of strangers cannot fill a phone. */
export const MAX_OPEN_OFFERS = 20;

/** What the offer code needs from the device it lives on. */
export interface OfferDeps {
  ctx: JobContext;
  transport: MailTransport;
  /** Set on a worker's phone: offers to work go to households, so a worker's phone drops them. */
  isWorker: boolean;
}

const newestFirst = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

/**
 * Offers to work through a personal QR (ADR 0034). A worker who scanned a household's QR offers; the household's phone
 * keeps it as a decision, and answering it is the household asking that worker through the usual request, or not.
 * Nothing goes back to the worker unless the household asks. Blocked people's offers are dropped either way.
 */
export class WorkOffers {
  private readonly store: OfferStore;
  private readonly blocks: MentorStore;

  constructor(
    private readonly d: OfferDeps,
    private readonly api?: QrApi,
  ) {
    this.store = new OfferStore(d.ctx.storage);
    this.blocks = new MentorStore(d.ctx.storage);
  }

  // ── Worker ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Offers to work for the household whose QR (`code`) this worker scanned. Throws QrError when it may not go. */
  async offer(code: QrCode, household: UserId, card: BoardProfile): Promise<void> {
    if (!this.api) throw new QrError(QrProblem.no_server);
    if (household === this.d.ctx.me.user) throw new QrError(OfferRefusal.enum.not_household);
    if (await this.blocks.isBlocked(household)) throw new QrError(QrProblem.blocked);
    const now = this.d.ctx.clock.now();
    const today = (await this.store.sent()).filter((o) => now.getTime() - Date.parse(o.at) < DAY_MS);
    if (today.some((o) => o.household === household)) throw new QrError(OfferRefusal.enum.offered_today);
    if (today.length >= OFFERS_PER_WORKER_DAY) throw new QrError(OfferRefusal.enum.worker_limit);
    if (!(await this.d.ctx.speaks(household, WORK_OFFER_PROTOCOL))) throw new QrError(QrProblem.too_old);
    try {
      await this.api.takeOffer(code);
    } catch (err) {
      throw qrProblemOf(err);
    }
    const channel = `eng_${ulid(now.getTime())}` as EngagementId;
    await this.d.transport.send(household, channel, EnvelopeKind.enum.work_offer, { card } satisfies WorkOffer);
    await this.store.saveSent({ channel, household, at: now.toISOString() });
  }

  /** True when this worker offered to work for `household` in the last day. */
  async offeredToday(household: UserId): Promise<boolean> {
    const now = this.d.ctx.clock.now().getTime();
    return (await this.store.sent()).some((o) => o.household === household && now - Date.parse(o.at) < DAY_MS);
  }

  // ── Household ───────────────────────────────────────────────────────────────────────────────────────────────────
  /** Takes in one offer: one open offer per worker (a new one replaces it), at most MAX_OPEN_OFFERS in all. */
  async receive({ envelope: e, body }: Received): Promise<void> {
    const worker = e.from.user;
    if (this.d.isWorker) return dropped(e.id, "a worker's phone");
    if (await this.blocks.isBlocked(worker)) return dropped(e.id, "blocked");
    const open = await this.open();
    const earlier = open.find((o) => o.worker === worker);
    if (!earlier && open.length >= MAX_OPEN_OFFERS) return dropped(e.id, "too many open offers");
    if (earlier) await this.store.removeReceived(earlier.channel);
    // A record inside the sealed card is the worker's own claim: the board's capped one is read when shown.
    const card = withoutRecord((body as WorkOffer).card);
    const at = this.d.ctx.clock.now().toISOString();
    await this.store.saveReceived({ channel: e.engagement, worker, card, state: OfferState.open, at });
  }

  /** Offers waiting for the household's answer, newest first; a week-old one is no longer shown. */
  async open(): Promise<ReceivedOffer[]> {
    const now = this.d.ctx.clock.now().getTime();
    const blocked = await this.blocks.blocked();
    return (await this.store.received())
      .filter((o) => o.state === OfferState.open && now - Date.parse(o.at) < OFFER_SHOWN_MS && !blocked.has(o.worker))
      .sort(newestFirst);
  }

  /** The record the board serves for an offer's worker, capped at what the server saw delivered; none offline. */
  async servedRecord(worker: UserId): Promise<WorkerRecord | undefined> {
    const card = await this.api?.workerCard(worker);
    return card && shownRecord(card);
  }

  /**
   * The household will ask this worker: the offer leaves Today, and the caller opens the usual request with the
   * worker chosen. Nothing is sent until the household sends that request.
   */
  async ask(channel: EngagementId): Promise<ReceivedOffer> {
    return this.answer(channel, OfferState.asked);
  }

  /** Not now: the offer leaves Today and nothing is sent. */
  async decline(channel: EngagementId): Promise<ReceivedOffer> {
    return this.answer(channel, OfferState.declined);
  }

  private async answer(channel: EngagementId, state: OfferState): Promise<ReceivedOffer> {
    const o = await this.store.receivedOn(channel);
    if (o?.state !== OfferState.open) throw new QrError(QrProblem.not_found);
    const next = { ...o, state };
    await this.store.saveReceived(next);
    return next;
  }
}

function dropped(messageId: string, reason: string): void {
  log.warn("work offer dropped", { messageId, reason });
}
