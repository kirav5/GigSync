import type { UserId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { MemoryDoc } from "./types.js";

const emptyMemory = (owner: UserId): MemoryDoc => ({ owner, facts: {}, people: {}, asked: {}, counted: [] });

/** This owner's memory, or an empty one. Kept in the owner's own storage and keyed by them as well. */
export async function load(storage: Storage, owner: UserId): Promise<MemoryDoc> {
  return (await storage.get<MemoryDoc>(Collection.memory, owner)) ?? emptyMemory(owner);
}

export function save(storage: Storage, doc: MemoryDoc): Promise<void> {
  return storage.put(Collection.memory, doc.owner, doc);
}
