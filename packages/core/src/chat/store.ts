import { log } from "../log.js";
import { Collection, type Storage } from "../ports.js";
import { type Chat, isChat } from "./chat.js";
import { newestFirst } from "./list.js";

/**
 * Before chats were kept, the agent logged every note it answered in this collection, one record each under this
 * prefix, read by nothing. Those copies would outlive a chat the owner deletes, so they go the first time chats load.
 */
const LEGACY_LOG_PREFIX = "ch_";

/**
 * The owner's chats on this phone, newest first (`storage` is already the owner's, ADR 0032). A record that does not
 * have a chat's shape, from an older or newer app, is left where it is and not shown.
 */
export async function loadChats(storage: Storage): Promise<Chat<unknown>[]> {
  const legacy = (await storage.ids(Collection.chat)).filter((id) => id.startsWith(LEGACY_LOG_PREFIX));
  await Promise.all(legacy.map((id) => storage.delete(Collection.chat, id)));
  if (legacy.length > 0) log.info("old agent log removed", { records: legacy.length });
  const kept = await storage.list<unknown>(Collection.chat);
  return newestFirst(kept.filter(isChat));
}

export function saveChat<T>(storage: Storage, chat: Chat<T>): Promise<void> {
  return storage.put(Collection.chat, chat.id, chat);
}

/** The owner deletes a chat: it is gone from this phone. */
export function deleteChat(storage: Storage, id: string): Promise<void> {
  return storage.delete(Collection.chat, id);
}
