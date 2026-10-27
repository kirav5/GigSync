/**
 * Everything the agent needs from the outside world, as interfaces. The app implements them with Capacitor plugins;
 * tests implement them in memory. Nothing in this package may import a browser, Node or Capacitor API directly, so
 * the core keeps running if the shell around it changes.
 */

import type { DevicePublicKeys, Sealed } from "@gigsync/crypto";
import type { DeviceId } from "@gigsync/protocol";

/** Every storage collection the agent uses. One name per kind of record, so two features never share one by accident. */
export const Collection = {
  chat: "chat",
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
  settings: "settings",
} as const;

export interface Storage {
  get<T>(collection: string, id: string): Promise<T | undefined>;
  put<T>(collection: string, id: string, value: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  list<T>(collection: string): Promise<T[]>;
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

export interface Model {
  /** Returns null when no model is available; the agent then says so instead of guessing. */
  generate(prompt: string, options?: { maxTokens?: number }): Promise<string | null>;
}

export interface Clock {
  now(): Date;
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
