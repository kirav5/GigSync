import { Collection, OWNER_SEP } from "@gigsync/core";
import type { EncryptedStorage, PlainRecord } from "./encrypted.js";

/**
 * Moving the old plaintext store (Capacitor Preferences: on the web, localStorage) into the encrypted one (ADR 0065).
 *
 * Runs on every start, before the app reads anything. Until the copy is checked and marked, the old store is the
 * truth and nothing in it is deleted, so a crash at any point is answered by doing it again. Once marked, the new
 * store is the truth: whatever plaintext is still found (a crash before the deleting was done, a tab still running
 * the app from before the move) is kept only where the new store has no such record, then deleted.
 */

/** The old store, as far as moving out of it needs. */
export interface LegacyStore {
  keys(): Promise<string[]>;
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  /** Notes, in the old store itself, that its records now live in the encrypted one. */
  flagMoved(): Promise<void>;
}

export interface LegacyRecord {
  /** The old store's key, `<collection>:<id>`. */
  key: string;
  collection: string;
  id: string;
}

export interface MoveResult {
  /** True when this run did the first full copy; false when it only cleared what was left over. */
  first: boolean;
  /** Old records written into the encrypted store. */
  copied: number;
  /** Old plaintext records deleted. */
  removed: number;
  /** Old records that are not JSON: left where they are. */
  unreadable: number;
}

export class MoveError extends Error {}

/** Where the device's own secrets are kept: not one of the agent's collections, and never an owner's. */
export const KEYS_COLLECTION = "keys";
/** Between collection and id in an old key. A collection's name never holds it; an id may. */
const KEY_SEP = ":";
const STORED: ReadonlySet<string> = new Set([...Object.values(Collection), KEYS_COLLECTION]);

/**
 * Which of the old store's keys are stored records, and where each goes. Anything else under Preferences (which
 * permissions were explained, voice settings) is not the agent's storage and stays.
 */
export function planMove(keys: readonly string[]): LegacyRecord[] {
  return keys.flatMap((key) => {
    const cut = key.indexOf(KEY_SEP);
    const collection = key.slice(0, Math.max(cut, 0));
    const [base] = collection.split(OWNER_SEP);
    return base !== undefined && STORED.has(base) ? [{ key, collection, id: key.slice(cut + 1) }] : [];
  });
}

async function read(legacy: LegacyStore, record: LegacyRecord): Promise<PlainRecord | undefined> {
  const text = await legacy.get(record.key);
  if (text === null) return undefined;
  try {
    return { collection: record.collection, id: record.id, value: JSON.parse(text) as unknown };
  } catch {
    return undefined;
  }
}

/** The ids the encrypted store holds, for each collection `records` touch. */
async function kept(vault: EncryptedStorage, records: readonly PlainRecord[]): Promise<Map<string, Set<string>>> {
  const collections = [...new Set(records.map((r) => r.collection))];
  const ids = await Promise.all(collections.map((c) => vault.ids(c)));
  return new Map(collections.map((c, i) => [c, new Set(ids[i])]));
}

const missingFrom = (held: Map<string, Set<string>>, records: readonly PlainRecord[]) =>
  records.filter((r) => !held.get(r.collection)?.has(r.id));

export async function moveLegacy(legacy: LegacyStore, vault: EncryptedStorage, now: Date): Promise<MoveResult> {
  const plan = planMove(await legacy.keys());
  const found = await Promise.all(plan.map(async (record) => ({ record, plain: await read(legacy, record) })));
  const readable = found.flatMap((f) => (f.plain === undefined ? [] : [{ key: f.record.key, plain: f.plain }]));
  const records = readable.map((r) => r.plain);

  const first = (await vault.moved()) === undefined;
  const wanted = first ? records : missingFrom(await kept(vault, records), records);
  await vault.putAll(wanted);
  // Checked before anything is deleted: every old record must be in the new store, and each one just copied must
  // open there and read as it did, or the old store stays as it is.
  const missing = missingFrom(await kept(vault, records), records).length;
  const copies = await Promise.all(wanted.map((r) => vault.get(r.collection, r.id).catch(() => undefined)));
  const wrong = wanted.filter((r, i) => JSON.stringify(copies[i]) !== JSON.stringify(r.value)).length;
  if (missing + wrong > 0)
    throw new MoveError(`of ${records.length} records, ${missing} are missing and ${wrong} read differently`);
  if (first) await vault.markMoved({ at: now.toISOString(), records: records.length });

  await legacy.flagMoved();
  await Promise.all(readable.map((r) => legacy.remove(r.key)));
  return { first, copied: wanted.length, removed: readable.length, unreadable: found.length - readable.length };
}
