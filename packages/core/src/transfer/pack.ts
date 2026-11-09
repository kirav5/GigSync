import { BOX_OVERHEAD_BYTES } from "@gigsync/crypto";
import { Lang, UserId } from "@gigsync/protocol";
import { OWNED_COLLECTIONS } from "../owner/storage.js";
import { Collection, type Storage } from "../ports.js";
import { type MovedRecord, type MovedRecords, MoveError, type MovePackage, MoveProblem } from "./types.js";

/** What a move package says it is, and the version of its shape this phone writes. */
export const MOVE_FORMAT = "gigsync-move";
export const MOVE_VERSION = 1;

/**
 * Records that belong to this device rather than its owner: envelopes still queued are signed by the old phone's key,
 * which the directory forgets once that phone is signed out, so they could never be delivered from the new one. When
 * this phone last pruned its seen ids is its own housekeeping: two phones always differ on it, and moving it would
 * ask the owner which to keep.
 */
export const DEVICE_BOUND: ReadonlySet<string> = new Set([Collection.outbox, Collection.inboxSweep]);

/** Every collection that moves: all the owner's own, except what is bound to the device. */
export const MOVED_COLLECTIONS: readonly string[] = OWNED_COLLECTIONS.filter((c) => !DEVICE_BOUND.has(c));

/**
 * What stays behind, in this order, when a package would not fit in a slot: the chats with the agent and its working
 * notes, which the owner can do without. Jobs, money, memory, mentors and settings always move.
 */
export const LEAVE_FIRST: readonly string[] = [Collection.chat, Collection.findChat, Collection.episodes];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** How many base64 characters `plainBytes` become once boxed: what a slot's limit counts. */
export const boxedChars = (plainBytes: number): number => 4 * Math.ceil((plainBytes + BOX_OVERHEAD_BYTES) / 3);

async function recordsOf(storage: Storage, collection: string): Promise<MovedRecord[]> {
  const ids = await storage.ids(collection);
  const records = await Promise.all(ids.map(async (id) => ({ id, value: await storage.get<unknown>(collection, id) })));
  return records.filter((r) => r.value !== undefined);
}

/** Every record the owner has on this phone that can move. `storage` is the owner's view of it (`ownerPorts`). */
export async function collectRecords(storage: Storage): Promise<MovedRecords> {
  const found = await Promise.all(MOVED_COLLECTIONS.map(async (c) => [c, await recordsOf(storage, c)] as const));
  return Object.fromEntries(found.filter(([, records]) => records.length > 0));
}

/** How many records the package carries, all collections together. */
export const recordCount = (records: MovedRecords): number =>
  Object.values(records).reduce((sum, list) => sum + list.length, 0);

interface PackInput {
  owner: UserId;
  lang?: Lang;
  now: Date;
  records: MovedRecords;
}

/**
 * The package as bytes, small enough that its box fits in `maxChars`: the collections in LEAVE_FIRST are left out one
 * by one until it does, and named in `left_out` so both phones can say so. Throws MoveError(too_big) when even without
 * them it would not fit.
 */
export function packMove(input: PackInput, maxChars: number): { bytes: Uint8Array; package: MovePackage } {
  const records = { ...input.records };
  const left_out: string[] = [];
  const pending = [...LEAVE_FIRST];
  for (;;) {
    const pkg: MovePackage = {
      format: MOVE_FORMAT,
      v: MOVE_VERSION,
      owner: input.owner,
      made_at: input.now.toISOString(),
      ...(input.lang ? { lang: input.lang } : {}),
      records,
      left_out: [...left_out],
    };
    const bytes = encoder.encode(JSON.stringify(pkg));
    if (boxedChars(bytes.length) <= maxChars) return { bytes, package: pkg };
    const next = pending.shift();
    if (next === undefined) throw new MoveError(MoveProblem.too_big);
    if (records[next]) {
      delete records[next];
      left_out.push(next);
    }
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isRecordList = (value: unknown): value is MovedRecord[] =>
  Array.isArray(value) && value.every((r) => isObject(r) && typeof r.id === "string" && "value" in r);

/** Only collections this phone keeps per owner are written; a newer phone's unknown ones are skipped. */
function knownRecords(value: unknown): MovedRecords | undefined {
  if (!isObject(value) || !Object.values(value).every(isRecordList)) return undefined;
  const moved = new Set(MOVED_COLLECTIONS);
  return Object.fromEntries(Object.entries(value as MovedRecords).filter(([c]) => moved.has(c)));
}

/**
 * The package the new phone opened, checked: that it is a move package, of a version this phone reads, for `owner`.
 * Throws MoveError: damaged, newer, or not_yours.
 */
export function readPackage(bytes: Uint8Array, owner: UserId): MovePackage {
  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(bytes));
  } catch {
    throw new MoveError(MoveProblem.damaged);
  }
  if (!isObject(value) || value.format !== MOVE_FORMAT || typeof value.v !== "number")
    throw new MoveError(MoveProblem.damaged);
  if (value.v > MOVE_VERSION) throw new MoveError(MoveProblem.newer);
  const from = UserId.safeParse(value.owner);
  if (!from.success) throw new MoveError(MoveProblem.damaged);
  if (from.data !== owner) throw new MoveError(MoveProblem.not_yours);
  const records = knownRecords(value.records);
  const lang = Lang.safeParse(value.lang);
  const leftOut = Array.isArray(value.left_out) ? value.left_out.filter((c) => typeof c === "string") : [];
  if (!records || typeof value.made_at !== "string") throw new MoveError(MoveProblem.damaged);
  return {
    format: MOVE_FORMAT,
    v: value.v,
    owner: from.data,
    made_at: value.made_at,
    ...(lang.success ? { lang: lang.data } : {}),
    records,
    left_out: leftOut,
  };
}
