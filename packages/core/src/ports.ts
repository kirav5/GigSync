/**
 * Everything the agent needs from the outside world, as interfaces. The app implements them with Capacitor plugins;
 * tests implement them in memory. Nothing in this package may import a browser, Node or Capacitor API directly, so
 * the core keeps running if the shell around it changes.
 */

/** Every storage collection the agent uses. One name per kind of record, so two features never share one by accident. */
export const Collection = {
  chat: "chat",
  contacts: "contacts",
  engagements: "engagements",
  episodes: "episodes",
  inboxCursor: "inbox_cursor",
  inboxSeen: "inbox_seen",
  outbox: "outbox",
  outboxSeq: "outbox_seq",
} as const;

export interface Storage {
  get<T>(collection: string, id: string): Promise<T | undefined>;
  put<T>(collection: string, id: string, value: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  list<T>(collection: string): Promise<T[]>;
}

export interface Keys {
  /** The device's public signing key, base64. */
  publicKey(): Promise<string>;
  sign(bytes: Uint8Array): Promise<Uint8Array>;
  verify(bytes: Uint8Array, signature: Uint8Array, publicKey: string): Promise<boolean>;
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
