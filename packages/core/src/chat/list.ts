import { localDay } from "../job/when.js";
import { type Chat, MAX_CHATS } from "./chat.js";

/** The day headings of the chat list, newest first. */
export const ChatDay = { today: "today", yesterday: "yesterday", earlier: "earlier" } as const;
export type ChatDay = (typeof ChatDay)[keyof typeof ChatDay];

export interface ChatGroup<C> {
  day: ChatDay;
  chats: readonly C[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds since the epoch; offsets differ between phones, so stamps are compared as instants, never as text. */
const at = (iso: string): number => Date.parse(iso);

/** Newest first: by when a turn was last added, then by when the chat was started. */
export function newestFirst<C extends Chat<unknown>>(chats: readonly C[]): C[] {
  return [...chats].sort((a, b) => at(b.updated_at) - at(a.updated_at) || at(b.started_at) - at(a.started_at));
}

/**
 * The chat list as the owner reads it: Today, Yesterday and Earlier, by the owner's own calendar (the phone is
 * `offsetMinutes` ahead of UTC), newest first in each, empty headings left out. A chat with nothing said in it yet is
 * not history, so it is not listed.
 */
export function groupChats<C extends Chat<unknown>>(
  chats: readonly C[],
  now: Date,
  offsetMinutes: number,
): ChatGroup<C>[] {
  const today = localDay(now, offsetMinutes);
  const yesterday = localDay(new Date(now.getTime() - MS_PER_DAY), offsetMinutes);
  const dayOf = (chat: C): ChatDay => {
    const day = localDay(new Date(chat.updated_at), offsetMinutes);
    if (day === today) return ChatDay.today;
    return day === yesterday ? ChatDay.yesterday : ChatDay.earlier;
  };
  const listed = newestFirst(chats.filter((c) => c.turns.length > 0));
  return Object.values(ChatDay)
    .map((day) => ({ day, chats: listed.filter((c) => dayOf(c) === day) }))
    .filter((group) => group.chats.length > 0);
}

/**
 * The chats to keep, newest first, and the ids of the ones dropped as the oldest past `MAX_CHATS`. The chats named in
 * `keep` (the one on screen, the one holding an unfinished card) are never dropped.
 */
export function pruneChats<C extends Chat<unknown>>(
  chats: readonly C[],
  keep: ReadonlySet<string>,
): { kept: C[]; dropped: string[] } {
  const sorted = newestFirst(chats);
  const room = Math.max(0, MAX_CHATS - sorted.filter((c) => keep.has(c.id)).length);
  const others = sorted.filter((c) => !keep.has(c.id));
  const dropped = new Set(others.slice(room).map((c) => c.id));
  return { kept: sorted.filter((c) => !dropped.has(c.id)), dropped: [...dropped] };
}
