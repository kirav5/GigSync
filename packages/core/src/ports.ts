/**
 * Everything the agent needs from the outside world, as interfaces. The app implements them with Capacitor plugins;
 * tests implement them in memory. Nothing in this package may import a browser, Node or Capacitor API directly, so
 * the core keeps running if the shell around it changes.
 */

import type { DevicePublicKeys, Sealed } from "@gigsync/crypto";
import type { DeviceId } from "@gigsync/protocol";

/**
 * Every storage collection the agent uses. One name per kind of record, so two features never share one by accident.
 * Each belongs to one owner (the person signed in), except the few kept per phone (`PHONE_COLLECTIONS`, owner/storage.ts).
 */
export const Collection = {
  /** Talk's chats, one record per chat, kept until the owner deletes one (chat/store.ts). */
  chat: "chat",
  /** A household's Find chats, one record per chat with its need, kept until the owner deletes one (chat/store.ts). */
  findChat: "find_chat",
  contacts: "contacts",
  engagements: "engagements",
  /** One record per job this device is part of (as consumer or worker). */
  jobs: "jobs",
  /** What a consumer is looking for, per request group: the need and their private budget. */
  needs: "needs",
  /** Decisions waiting for the owner: confirm a deal, answer questions, confirm a payment. */
  tasks: "tasks",
  /** Payment requests received, with the worker's UPI ID, so the consumer can open a UPI app. */
  paymentRequests: "payment_requests",
  episodes: "episodes",
  inboxCursor: "inbox_cursor",
  inboxSeen: "inbox_seen",
  outbox: "outbox",
  outboxSeq: "outbox_seq",
  payments: "payments",
  /** Settings of the phone itself, shared by everyone who signs in on it: the account, language, model choice. */
  settings: "settings",
  /** Settings of one owner: their UPI ID, whether the agent asks before answering from memory. */
  ownerSettings: "owner_settings",
  /** Names a consumer saw on the board, by user id, so their jobs show who they are talking to. */
  people: "people",
  /**
   * Live mentor links, one record per person. Kept under the name links had when workers also linked in person, so
   * links opened before that went away still read.
   */
  mentorLinks: "colleagues",
  /** The notes on one mentor link, one document per person; under their old name for the same reason. */
  linkNotes: "colleague_notes",
  /** Mentor links that ran out or were ended: who this owner knew, so they can still introduce them. */
  pastLinks: "past_links",
  /** What the agent remembers from past signed jobs, one document per owner; kept when they sign out. */
  memory: "memory",
  /** Landing requests this phone sent as a newcomer, one per mentor asked. */
  mentorRequests: "mentor_requests",
  /** Landing requests this phone received as a mentor. */
  mentorAsks: "mentor_asks",
  /** Introductions toward a mentor link this phone is one of the two sides of. */
  mentorIntros: "mentor_intros",
  /** Answers to an introduction that came before the introduction itself, until it arrives. */
  mentorEarly: "mentor_early",
  /** The owner's own mentor choices and newcomer answers, kept on this phone only. */
  mentorSettings: "mentor_settings",
  /** People this owner blocked: hidden everywhere this owner looks on this phone. */
  blocked: "blocked",
  /** Moves to a new city, one record per move, kept on this phone (the landing journey). */
  journeys: "journeys",
  /** City guides as last downloaded, one per city, so the landing journey works offline. */
  guides: "guides",
  /** Offers to work this household received from a worker who scanned its QR (ADR 0034), one per channel. */
  workOffers: "work_offers",
  /** Offers to work this worker sent, one per channel: the day's count and "offered" on a household's view. */
  offersSent: "offers_sent",
  /** What GigSync accepted of this owner's job records (ADR 0038), one record per fact: what is still to send is the rest. */
  recordsSent: "records_sent",
} as const;

export interface Storage {
  get<T>(collection: string, id: string): Promise<T | undefined>;
  put<T>(collection: string, id: string, value: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  list<T>(collection: string): Promise<T[]>;
  /** The ids in a collection, for moving records between collections (see owner/claim.ts). */
  ids(collection: string): Promise<string[]>;
}

/**
 * The device's private keys stay behind this port (a keystore on the phone). Everything public — sealing to someone,
 * checking a signature — needs no secret and is done with @gigsync/crypto directly.
 */
export interface Keys {
  /** This device's public keys, as registered at sign-in. */
  publicKeys(): Promise<DevicePublicKeys>;
  /** Ed25519 with the device's signing key. */
  sign(bytes: Uint8Array): Promise<Uint8Array>;
  /** Opens a body sealed to this device; throws when it was not sealed to it or was altered. */
  open(sealed: Sealed, device: DeviceId): Promise<Uint8Array>;
}

/** Reply length when a caller does not ask for one: enough for a chat answer, short enough for a phone. */
export const DEFAULT_MAX_TOKENS = 256;

/**
 * How a model should answer: at most `maxTokens`, and how freely (`temperature` 0: the same answer to the same prompt,
 * which routing needs). An engine that cannot honour an option ignores it.
 */
export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface Model {
  /** Returns null when no model is available; the agent then says so instead of guessing. */
  generate(prompt: string, options?: GenerateOptions): Promise<string | null>;
}

export interface Clock {
  now(): Date;
}

/**
 * Uniform numbers in [0, 1). The app's comes from the platform's cryptographic source (`crypto.getRandomValues`), so
 * nobody can predict a job's hidden negotiation settings (ADR 0033); tests pass a seeded one. Never `Math.random`.
 */
export interface Random {
  next(): number;
}

export interface Ports {
  storage: Storage;
  keys: Keys;
  model: Model;
  clock: Clock;
}

/** In-memory implementations for tests and the web preview. */
export class MemoryStorage implements Storage {
  private data = new Map<string, Map<string, unknown>>();
  private bucket(c: string) {
    const existing = this.data.get(c);
    if (existing) return existing;
    const fresh = new Map<string, unknown>();
    this.data.set(c, fresh);
    return fresh;
  }
  async get<T>(c: string, id: string) {
    return this.bucket(c).get(id) as T | undefined;
  }
  async put<T>(c: string, id: string, v: T) {
    this.bucket(c).set(id, v);
  }
  async delete(c: string, id: string) {
    this.bucket(c).delete(id);
  }
  async list<T>(c: string) {
    return [...this.bucket(c).values()] as T[];
  }
  async ids(c: string) {
    return [...this.bucket(c).keys()];
  }
}

export class NoModel implements Model {
  async generate() {
    return null;
  }
}

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}
