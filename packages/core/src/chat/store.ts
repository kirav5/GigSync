import { log } from "../log.js";
import { Collection, type Storage } from "../ports.js";
import { type Chat, isChat } from "./chat.js";
import { newestFirst } from "./list.js";

/**
 * Where each kind of chat is kept: a worker's Talk chats and a household's Find chats each have their own collection,
 * so neither app reads the other's turns as its own (ADR 0035).
 */
export const ChatShelf = { talk: Collection.chat, find: Collection.findChat } as const;
export type ChatShelf = (typeof ChatShelf)[keyof typeof ChatShelf];

/**
 * Before chats were kept, the agent logged every note it answered in Talk's collection, one record each under this
 * prefix, read by nothing. Those copies would outlive a chat the owner deletes, so they go the first time chats load.
 */
const LEGACY_LOG_PREFIX = "ch_";

async function removeLegacyLog(storage: Storage): Promise<void> {
  const legacy = (await storage.ids(ChatShelf.talk)).filter((id) => id.startsWith(LEGACY_LOG_PREFIX));
  await Promise.all(legacy.map((id) => storage.delete(ChatShelf.talk, id)));
  if (legacy.length > 0) log.info("old agent log removed", { records: legacy.length });
}

/**
 * The owner's chats of one kind on this phone, newest first (`storage` is already the owner's, ADR 0032). A record
 * that does not have a chat's shape, from an older or newer app, is left where it is and not shown.
 */
export async function loadChats(storage: Storage, shelf: ChatShelf): Promise<Chat<unknown>[]> {
  if (shelf === ChatShelf.talk) await removeLegacyLog(storage);
  const kept = await storage.list<unknown>(shelf);
  return newestFirst(kept.filter(isChat));
}

export function saveChat<T>(storage: Storage, shelf: ChatShelf, chat: Chat<T>): Promise<void> {
  return storage.put(shelf, chat.id, chat);
}

/** The owner deletes a chat: it is gone from this phone. */
export function deleteChat(storage: Storage, shelf: ChatShelf, id: string): Promise<void> {
  return storage.delete(shelf, id);
}
