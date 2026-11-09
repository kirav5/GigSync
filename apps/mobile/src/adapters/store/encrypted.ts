import type { Storage } from "@gigsync/core";
import { log } from "@gigsync/core";
import { Database, type SealedRecord } from "./database.js";
import { newStorageKey, open, seal } from "./envelope.js";

/** What the database's `meta` store holds. */
const Meta = {
  /** The non-extractable AES key every record is sealed with. */
  storageKey: "storage_key",
  /** `{ at, records }`: when the old plaintext store was copied here and checked, and how many records it held. */
  moved: "moved_from_preferences",
  /** `{ at, granted }`: the browser's answer the one time it was asked to keep this storage. */
  persistence: "persistence_asked",
} as const;

/** A record to seal and keep. */
export interface PlainRecord {
  collection: string;
  id: string;
  value: unknown;
}

export interface Moved {
  at: string;
  records: number;
}

export interface PersistenceAnswer {
  at: string;
  granted: boolean;
}

const PROBE = "probe";
/** Stands for a record `list` could not open; no stored value is this symbol. */
const UNREADABLE = Symbol("unreadable");

/**
 * Core's storage port on IndexedDB, every value sealed at rest (ADR 0065). `get` throws on a record that cannot be
 * opened, since a caller that took it for missing would write over it; `list` leaves such a record out and says so,
 * so one bad record does not take a whole screen with it.
 */
export class EncryptedStorage implements Storage {
  /**
   * Every write begun so far, one after the other. Sealing takes a moment, so without this two writes to one record
   * could land in either order, and a read begun after a write could miss it; callers count on the order they called in.
   */
  private writes: Promise<void> = Promise.resolve();

  private constructor(
    private readonly db: Database,
    private readonly key: CryptoKey,
  ) {}

  private write(work: () => Promise<void>): Promise<void> {
    const done = this.writes.then(work);
    this.writes = done.catch(() => undefined);
    return done;
  }

  private async read<T>(work: () => Promise<T>): Promise<T> {
    await this.writes;
    return work();
  }

  /** Done once every write begun before the call is in the database, or has failed. */
  settled(): Promise<void> {
    return this.writes;
  }

  /**
   * Opens the database and loads its key, making one on the first start. Throws where that cannot work (no IndexedDB
   * in a private window, an engine that cannot keep a CryptoKey), after proving a record survives the round trip:
   * the caller then stays on the old store.
   */
  static async open(factory: IDBFactory): Promise<EncryptedStorage> {
    const db = await Database.open(factory);
    const kept = (await db.meta(Meta.storageKey)) ?? (await db.metaOnce(Meta.storageKey, await newStorageKey()));
    if (!(kept instanceof CryptoKey)) throw new Error("storage key did not survive IndexedDB");
    await open(kept, PROBE, PROBE, await seal(kept, PROBE, PROBE, PROBE));
    return new EncryptedStorage(db, kept);
  }

  get<T>(collection: string, id: string): Promise<T | undefined> {
    return this.read(async () => {
      const sealed = await this.db.get(collection, id);
      return sealed === undefined ? undefined : ((await open(this.key, collection, id, sealed)) as T);
    });
  }

  put<T>(collection: string, id: string, value: T): Promise<void> {
    return this.write(async () => this.db.putAll([await this.sealed({ collection, id, value })]));
  }

  delete(collection: string, id: string): Promise<void> {
    return this.write(() => this.db.delete(collection, id));
  }

  async list<T>(collection: string): Promise<T[]> {
    const sealed = await this.read(() => this.db.list(collection));
    const opened = await Promise.all(
      sealed.map((r) => open(this.key, r.collection, r.id, r.sealed).catch(() => UNREADABLE)),
    );
    const readable = opened.filter((value) => value !== UNREADABLE);
    if (readable.length < opened.length)
      log.error("stored records could not be opened", { collection, count: opened.length - readable.length });
    return readable as T[];
  }

  ids(collection: string): Promise<string[]> {
    return this.read(() => this.db.ids(collection));
  }

  /** Seals and keeps all of them in one flushed transaction: all are kept, or none. */
  putAll(records: readonly PlainRecord[]): Promise<void> {
    return this.write(async () => this.db.putAllDurably(await Promise.all(records.map((r) => this.sealed(r)))));
  }

  async moved(): Promise<Moved | undefined> {
    return (await this.db.meta(Meta.moved)) as Moved | undefined;
  }

  markMoved(moved: Moved): Promise<void> {
    return this.db.setMeta(Meta.moved, moved);
  }

  async persistence(): Promise<PersistenceAnswer | undefined> {
    return (await this.db.meta(Meta.persistence)) as PersistenceAnswer | undefined;
  }

  markPersistence(answer: PersistenceAnswer): Promise<void> {
    return this.db.setMeta(Meta.persistence, answer);
  }

  private async sealed(r: PlainRecord): Promise<SealedRecord> {
    return { collection: r.collection, id: r.id, sealed: await seal(this.key, r.collection, r.id, r.value) };
  }
}
