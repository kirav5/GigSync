import type { Chat, MessageKey } from "@gigsync/core";
import { openFindChat, removeFindChat, useNeed } from "../find/findChats.js";
import { openChat, removeChat, useTalk } from "../talk/talkStore.js";

/**
 * The chats the menu lists for the owner signed in: a worker's Talk chats, or a household's Find chats (ADR 0035). Both
 * are listed, opened and deleted the same way; only what a row notes and what Delete asks differ.
 */
export interface ChatList {
  /** Every chat with something said in it, and possibly the open one while it is empty. */
  chats: readonly Chat<unknown>[];
  open: string;
  /** A line under a chat's title: Talk's unfinished card, or a need not yet sent to workers. */
  noteOf: (id: string) => MessageKey | undefined;
  /** What Delete asks before removing a chat. */
  confirmOf: (id: string) => MessageKey;
  openChat: (id: string) => void;
  removeChat: (id: string) => void;
}

/** The owner's chats, as the menu and the top bar read them. */
export function useChatList(isWorker: boolean): ChatList {
  const talk = useTalk();
  const find = useNeed();
  if (isWorker) {
    const card = (id: string) => id === talk.interviewIn;
    return {
      chats: talk.chats,
      open: talk.open,
      noteOf: (id) => (card(id) ? "chats.card_waiting" : undefined),
      confirmOf: (id) => (card(id) ? "chats.delete_confirm_card" : "chats.delete_confirm"),
      openChat,
      removeChat,
    };
  }
  // A household's chat without a need has had its workers asked: its job lives on in My jobs.
  const unsent = (id: string) => find.chats.some((c) => c.id === id && c.need !== undefined);
  return {
    chats: find.chats,
    open: find.open,
    noteOf: (id) => (unsent(id) ? "chats.need_unsent" : undefined),
    confirmOf: (id) => (unsent(id) ? "chats.delete_confirm" : "chats.delete_confirm_sent"),
    openChat: openFindChat,
    removeChat: removeFindChat,
  };
}
