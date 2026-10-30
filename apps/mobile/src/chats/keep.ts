import { type Chat, type ChatShelf, deleteChat, log, type Storage, saveChat } from "@gigsync/core";

/**
 * Keeps a list of chats on the phone as it changes, for Talk and for Find alike (ADR 0035): each chat is one record,
 * rewritten when the chat changes and removed when it is deleted or holds nothing worth keeping.
 */

/** How one kind of chat is kept. */
export interface Keeping<C extends Chat<unknown>> {
  /** The record kept for a chat, or undefined when nothing in it is worth keeping yet. */
  recordOf: (chat: C) => Chat<unknown> | undefined;
  /** Whether a chat changed since `before`; by default, when it is no longer the same object. */
  changed?: (chat: C, before: C | undefined) => boolean;
}

/** Writes run one after another, so a chat's records land in the order its turns changed. */
let writes: Promise<void> = Promise.resolve();
function queue(shelf: ChatShelf, job: () => Promise<void>): void {
  writes = writes
    .then(job)
    .catch((err: unknown) =>
      log.warn("chat not kept", { shelf, error: err instanceof Error ? err.message : String(err) }),
    );
}

const replaced = <C>(chat: C, before: C | undefined): boolean => chat !== before;

/** Keeps on `storage` (the owner's) what changed from `prev` to `next`: chats changed, emptied or gone. */
export function keepChats<C extends Chat<unknown>>(
  storage: Storage,
  shelf: ChatShelf,
  prev: readonly C[],
  next: readonly C[],
  { recordOf, changed = replaced }: Keeping<C>,
): void {
  const before = new Map(prev.map((c) => [c.id, c]));
  for (const chat of next) {
    const old = before.get(chat.id);
    if (!changed(chat, old)) continue;
    const record = recordOf(chat);
    if (record) queue(shelf, () => saveChat(storage, shelf, record));
    else if (old) queue(shelf, () => deleteChat(storage, shelf, chat.id));
  }
  const kept = new Set(next.map((c) => c.id));
  for (const id of before.keys()) if (!kept.has(id)) queue(shelf, () => deleteChat(storage, shelf, id));
}
