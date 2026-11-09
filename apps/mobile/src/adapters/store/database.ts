/**
 * The phone's database on the web (ADR 0065): IndexedDB, two object stores.
 *
 * `records` holds every stored record, sealed (envelope.ts), under the key `[collection, id]`. IndexedDB orders array
 * keys element by element, so one collection's records sit next to each other and a key range reads exactly them: no
 * scan of anything else, and no second index to keep. An owner's collections carry the owner in their name
 * (`jobs@usr_…`, core's owner storage), so the same range keeps owners apart.
 *
 * `meta` holds what is not a record: the storage key itself, and when the old store was moved here.
 */

const DATABASE = "gigsync-store";
const SCHEMA_VERSION = 1;
const RECORDS = "records";
const META = "meta";
const READ = "readonly";
const WRITE = "readwrite";
/** Flushed to disk before the transaction reports done: for writes whose plaintext original is deleted next. */
const DURABLE: IDBTransactionOptions = { durability: "strict" };

export interface SealedRecord {
  collection: string;
  id: string;
  sealed: Uint8Array;
}

const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** A write counts once its transaction has committed, not when its request succeeded. */
const committed = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("storage transaction aborted"));
  });

/**
 * Every key of one collection: from `[collection]` (below any `[collection, id]`) up to `[collection, []]` (above
 * them all, since IndexedDB sorts an array after every string).
 */
const within = (collection: string) => IDBKeyRange.bound([collection], [collection, []]);

const idOf = (key: IDBValidKey): string => (Array.isArray(key) ? String(key[1]) : String(key));

function bytesOf(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  throw new Error("stored record is not bytes");
}

export class Database {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(factory: IDBFactory): Promise<Database> {
    const request = factory.open(DATABASE, SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RECORDS);
      request.result.createObjectStore(META);
    };
    return new Database(await result(request));
  }

  async get(collection: string, id: string): Promise<Uint8Array | undefined> {
    const found: unknown = await result(this.db.transaction(RECORDS, READ).objectStore(RECORDS).get([collection, id]));
    return found === undefined ? undefined : bytesOf(found);
  }

  /** One transaction for all of them: every record is written, or none. */
  async putAll(records: readonly SealedRecord[], options?: IDBTransactionOptions): Promise<void> {
    if (records.length === 0) return;
    const tx = this.db.transaction(RECORDS, WRITE, options);
    const store = tx.objectStore(RECORDS);
    for (const r of records) store.put(r.sealed, [r.collection, r.id]);
    await committed(tx);
  }

  putAllDurably(records: readonly SealedRecord[]): Promise<void> {
    return this.putAll(records, DURABLE);
  }

  async delete(collection: string, id: string): Promise<void> {
    const tx = this.db.transaction(RECORDS, WRITE);
    tx.objectStore(RECORDS).delete([collection, id]);
    await committed(tx);
  }

  /** One collection's records in id order, read through the key range alone. */
  async list(collection: string): Promise<SealedRecord[]> {
    const store = this.db.transaction(RECORDS, READ).objectStore(RECORDS);
    const [keys, values] = await Promise.all([
      result(store.getAllKeys(within(collection))),
      result<unknown[]>(store.getAll(within(collection))),
    ]);
    return keys.map((key, i) => ({ collection, id: idOf(key), sealed: bytesOf(values[i]) }));
  }

  async ids(collection: string): Promise<string[]> {
    const store = this.db.transaction(RECORDS, READ).objectStore(RECORDS);
    return (await result(store.getAllKeys(within(collection)))).map(idOf);
  }

  meta(name: string): Promise<unknown> {
    return result(this.db.transaction(META, READ).objectStore(META).get(name));
  }

  async setMeta(name: string, value: unknown): Promise<void> {
    const tx = this.db.transaction(META, WRITE, DURABLE);
    tx.objectStore(META).put(value, name);
    await committed(tx);
  }

  /**
   * Keeps `value` under `name` unless something is there already, and returns what is kept. Read and write share one
   * transaction, so two tabs opening the app for the first time end up with the same storage key, not one each.
   */
  async metaOnce(name: string, value: unknown): Promise<unknown> {
    const tx = this.db.transaction(META, WRITE, DURABLE);
    const store = tx.objectStore(META);
    const kept = new Promise<unknown>((resolve, reject) => {
      const read = store.get(name);
      read.onerror = () => reject(read.error);
      read.onsuccess = () => {
        if (read.result !== undefined) return resolve(read.result);
        store.put(value, name);
        resolve(value);
      };
    });
    const [winner] = await Promise.all([kept, committed(tx)]);
    return winner;
  }
}
