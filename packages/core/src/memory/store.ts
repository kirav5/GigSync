import type { UserId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { MemoryDoc } from "./types.js";

const emptyMemory = (owner: UserId): MemoryDoc => ({ owner, facts: {}, people: {}, asked: {}, counted: [] });

/** This owner's memory, or an empty one. Keyed by owner, so a phone handed on never shows one owner's to the next. */
export async function load(storage: Storage, owner: UserId): Promise<MemoryDoc> {
  return (await storage.get<MemoryDoc>(Collection.memory, owner)) ?? emptyMemory(owner);
}

export function save(storage: Storage, doc: MemoryDoc): Promise<void> {
  return storage.put(Collection.memory, doc.owner, doc);
}

/** Every owner's memory on this phone, gone: what sign-out does, since phones are shared. */
export async function wipeMemory(storage: Storage): Promise<void> {
  const all = await storage.list<MemoryDoc>(Collection.memory);
  await Promise.all(all.map((doc) => storage.delete(Collection.memory, doc.owner)));
}
