import type { Recipient } from "@gigsync/crypto";
import {
  DEFAULT_TTL_SECONDS,
  type DeviceId,
  type DeviceKeys,
  type EngagementId,
  type Envelope,
  EnvelopeKind,
  PROTOCOL_VERSION,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { log } from "../log.js";
import { HttpError, type Relay } from "../net/api.js";
import type { Clock, Keys, Storage } from "../ports.js";
import { Inbox, Outcome } from "./inbox.js";
import { Outbox } from "./outbox.js";
import { EnvelopeError, openEnvelope, sealEnvelope } from "./sealed.js";

/** One envelope that passed its signature check, opened for this device, in order. */
export interface Received {
  envelope: Envelope;
  body: unknown;
}

const MS_PER_SECOND = 1000;
/**
 * How long a user's device list is trusted for sealing. A person who signs in again, or on another phone, has a new
 * device; a list kept for as long as the app ran sealed every later message to the old one only, and the new phone
 * dropped it unread (a household's second request to the same worker never reached him).
 */
const DEVICE_LIST_MS = 60 * MS_PER_SECOND;
/**
 * A request opens a job, so it is sealed to the devices the directory lists right now: a list read a moment before
 * the worker signed in on a new phone would miss it, and requests are few.
 */
const FRESH_LIST_KINDS: ReadonlySet<EnvelopeKind> = new Set([EnvelopeKind.enum.request]);
/** 4xx answers other than these mean the envelope itself is wrong; retrying cannot help, so it is dropped. */
const RETRYABLE = new Set([408, 425, 429]);
const isPermanent = (err: unknown) =>
  err instanceof HttpError && err.status >= 400 && err.status < 500 && !RETRYABLE.has(err.status);

/**
 * Moves envelopes between this device and the mailbox. Sending seals to every device the recipient has registered,
 * signs and queues in the durable outbox. Receiving checks each signature against the directory, opens the body,
 * drops duplicates, delivers in order per sender and acknowledges what it took.
 */
export class MailTransport {
  private readonly outbox: Outbox;
  private readonly inbox: Inbox;
  private readonly devices = new Map<UserId, { list: DeviceKeys[]; at: number }>();

  constructor(
    private readonly relay: Relay,
    storage: Storage,
    private readonly keys: Keys,
    private readonly clock: Clock,
    private readonly me: { user: UserId; device: DeviceId },
  ) {
    this.outbox = new Outbox(storage);
    this.inbox = new Inbox(storage);
  }

  /** Seals, signs and queues one envelope; `flush` hands it to the mailbox. */
  async send(to: UserId, engagement: EngagementId, kind: EnvelopeKind, body: unknown): Promise<Envelope> {
    const now = this.clock.now();
    const recipients: Recipient[] = (await this.devicesOf(to, FRESH_LIST_KINDS.has(kind))).map((d) => ({
      device: d.device_id,
      encryption_key: d.encryption_key,
    }));
    const header = {
      v: PROTOCOL_VERSION,
      id: `msg_${ulid(now.getTime())}`,
      from: this.me,
      to: { user: to },
      engagement,
      seq: await this.outbox.nextSeq(engagement, to),
      kind,
      sent_at: now.toISOString(),
      expires_at: new Date(now.getTime() + DEFAULT_TTL_SECONDS.job * MS_PER_SECOND).toISOString(),
    };
    const envelope = await sealEnvelope(header, body, recipients, this.keys);
    await this.outbox.enqueue(envelope, now);
    return envelope;
  }

  /** Delivers everything due, oldest first. Returns how many the mailbox took. */
  async flush(): Promise<number> {
    let delivered = 0;
    // In sequence on purpose: per-engagement order is kept by seq, and a phone sends few envelopes at a time.
    for (const p of await this.outbox.due(this.clock.now())) {
      try {
        await this.relay.deliver(p.envelope);
        await this.outbox.sent(p.envelope.id);
        delivered++;
      } catch (err) {
        if (isPermanent(err)) {
          log.warn("envelope refused by the mailbox", { messageId: p.envelope.id, kind: p.envelope.kind });
          await this.outbox.sent(p.envelope.id);
        } else await this.outbox.failed(p.envelope.id, this.clock.now());
      }
    }
    return delivered;
  }

  /**
   * Fetches, verifies and opens what the mailbox holds, hands each to `handle` in order, and acknowledges only once all
   * were handled. An envelope counts as delivered only after `handle` finished with it (or it can never be opened), so a
   * crash, a directory timeout or a failing handler leaves it to come again on the next sync. Returns how many were
   * handled.
   */
  async receive(handle: (r: Received) => Promise<void>): Promise<number> {
    const fetched = await this.relay.inbox();
    if (fetched.length === 0) return 0;
    let handled = 0;
    const ordered = [...fetched].sort((a, b) => a.seq - b.seq);
    for (const e of ordered) {
      const accepted = await this.inbox.offer(e, this.clock.now());
      if (accepted.outcome !== Outcome.new) continue;
      for (const ready of accepted.deliver) {
        const body = await this.tryOpen(ready);
        if (body !== undefined) {
          await handle({ envelope: ready, body });
          handled += 1;
        }
        await this.inbox.delivered(ready, this.clock.now());
      }
    }
    await this.relay.ack(fetched.map((e) => e.id));
    return handled;
  }

  private async tryOpen(e: Envelope): Promise<unknown> {
    try {
      const key = await this.signingKeyOf(e.from.user, e.from.device);
      if (!key) throw new EnvelopeError(`unknown sender device on ${e.id}`);
      return await openEnvelope(e, this.me.device, this.keys, key);
    } catch (err) {
      if (!(err instanceof EnvelopeError)) throw err;
      log.warn("envelope dropped", { messageId: e.id, kind: e.kind, from: e.from.user, reason: err.message });
      return undefined;
    }
  }

  /** The signing key the directory lists for one of a user's devices. */
  async signingKeyOf(user: UserId, device: DeviceId): Promise<string | undefined> {
    const find = (list: DeviceKeys[]) => list.find((d) => d.device_id === device)?.signing_key;
    // A device we have not seen may be new since we cached the list: look once more.
    return find(await this.devicesOf(user)) ?? find(await this.devicesOf(user, true));
  }

  private async devicesOf(user: UserId, refresh = false): Promise<DeviceKeys[]> {
    const now = this.clock.now().getTime();
    const cached = this.devices.get(user);
    if (cached && !refresh && now - cached.at < DEVICE_LIST_MS) return cached.list;
    const entry = await this.relay.directory(user);
    this.devices.set(user, { list: entry.devices, at: now });
    return entry.devices;
  }
}
