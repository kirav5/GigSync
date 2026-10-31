import {
  type Chat,
  ChatShelf,
  loadChats,
  MAX_CHATS,
  NeedSlot,
  type NeedState,
  type NeedTo,
  newChat,
  type Ports,
  pruneChats,
  withTurns,
} from "@gigsync/core";
import { useSyncExternalStore } from "react";
import { keepFindChanges, readFindChat } from "./findPersist.js";
import { type NeedTurn, needTurnIdsSeen, needWordsOf, saidIn } from "./needTurns.js";

/**
 * A household's Find chats, kept like a worker's Talk chats (ADR 0035, Households): outside any screen so they survive
 * switching tabs, and on the phone under their owner so they survive a restart and signing out and in. Each chat holds
 * one need: asked about until the workers are asked, then kept as a record of what was said, its job living on in My
 * jobs. One chat is open on screen; "New chat" keeps it in the list and opens an empty one; the household can open any
 * chat again, where an unsent need carries on, or delete it. A chat can be addressed to one worker the household
 * chose first (their QR, their offer to work): its need goes to them alone.
 */

/** A Find chat: what was said, and the need being asked about in it until the workers are asked. */
export interface FindChat extends Chat<NeedTurn> {
  need?: NeedState | undefined;
  /** The worker a new chat is addressed to, until its need begins (the need carries it from then on). */
  to?: NeedTo | undefined;
}

export interface Find {
  /** The owner's chats have been read from the phone. */
  ready: boolean;
  /** Every chat, the open one included while nothing is said in it. */
  chats: readonly FindChat[];
  open: string;
}

/** What the screens read: the open chat's need and turns, and the chats kept as history. */
export interface NeedSnapshot {
  ready: boolean;
  open: string;
  /** The need being asked about; undefined before the first question and once the workers were asked. */
  state?: NeedState | undefined;
  turns: readonly NeedTurn[];
  /** The worker the open chat is addressed to, before its need begins. */
  to?: NeedTo | undefined;
  /** The chats the household said something in, for the menu. */
  chats: readonly FindChat[];
}

/** A search for one chat's need, claimed by the one caller that runs it. */
export interface SearchClaim {
  chat: string;
  generation: number;
}

type Owner = Pick<Ports, "storage" | "clock">;

const blank = (now: Date): Find => {
  const chat = newChat<NeedTurn>(now);
  return { ready: false, chats: [chat], open: chat.id };
};

let find: Find = blank(new Date());
/** The signed-in owner's storage and clock; undefined while signed out or loading. */
let owner: Owner | undefined;
/** Counts loads and sign-outs: a load or a search that finishes after the next one began is dropped. */
let generation = 0;
/** Chats whose search is under way: Find may be left and opened again meanwhile, and must not search twice. */
const searching = new Set<string>();
const listeners = new Set<() => void>();

const chatIn = (f: Find, id: string): FindChat | undefined => f.chats.find((c) => c.id === id);
const now = (): Date => owner?.clock.now() ?? new Date();

function viewOf(f: Find): NeedSnapshot {
  const open = chatIn(f, f.open);
  return {
    ready: f.ready,
    open: f.open,
    state: open?.need,
    turns: open?.turns ?? [],
    to: open?.to,
    chats: f.chats.filter(saidIn),
  };
}
let view: NeedSnapshot = viewOf(find);

function show(next: Find): void {
  find = next;
  view = viewOf(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNeed(): NeedSnapshot {
  return useSyncExternalStore(subscribe, () => view);
}

/** Changes Find: past the cap the oldest chats go (never the open one), and the change is kept. */
function updateFind(change: (f: Find) => Find): void {
  const prev = find;
  let next = change(prev);
  if (next === prev) return;
  if (next.chats.length > MAX_CHATS) next = { ...next, chats: pruneChats(next.chats, new Set([next.open])).kept };
  if (owner) keepFindChanges(owner.storage, prev, next);
  show(next);
}

/** Changes one chat, open or not; a chat deleted meanwhile changes nothing. */
export function changeChat(id: string, change: (chat: FindChat) => FindChat): void {
  updateFind((f) => {
    const chat = chatIn(f, id);
    if (!chat) return f;
    const next = change(chat);
    return next === chat ? f : { ...f, chats: f.chats.map((c) => (c === chat ? next : c)) };
  });
}

/** `chat` with its turns now `turns`: titled from the household's first words, the newest kept past the cap. */
export const withNeedTurns = (chat: FindChat, turns: readonly NeedTurn[]): FindChat =>
  withTurns(chat, turns, now(), needWordsOf);

/** Leaving the open chat: one the household said nothing in goes, since it is not history. */
function leave(f: Find): Find {
  const open = chatIn(f, f.open);
  return open && !saidIn(open) ? { ...f, chats: f.chats.filter((c) => c !== open) } : f;
}

/**
 * "New chat": the open chat stays in the list, and an empty one opens; nothing happens while nothing is said in it.
 * Addressed `to` a worker, the new chat always opens, in place of an open one with nothing said in it.
 */
export function startFindChat(to?: NeedTo): void {
  updateFind((f) => {
    const open = chatIn(f, f.open);
    if (!to && (!open || !saidIn(open))) return f;
    const chat: FindChat = { ...newChat<NeedTurn>(now()), ...(to ? { to } : {}) };
    const left = leave(f);
    return { ...left, chats: [chat, ...left.chats], open: chat.id };
  });
}

/** A need was sent from chat `id`: when it is open, a new chat opens for the next need, and it stays in the list. */
export function movedOnFrom(id: string): void {
  if (find.open === id) startFindChat();
}

/** Opens a chat from the list, as a conversation: an unsent need carries on, a sent one is there to read. */
export function openFindChat(id: string): void {
  updateFind((f) => {
    if (f.open === id || !chatIn(f, id)) return f;
    return { ...leave(f), open: id };
  });
}

/** The household deletes a chat: gone from the phone (its job stays in My jobs); deleting the open one opens a new one. */
export function removeFindChat(id: string): void {
  updateFind((f) => {
    if (!chatIn(f, id)) return f;
    searching.delete(id);
    const chats = f.chats.filter((c) => c.id !== id);
    if (f.open !== id) return { ...f, chats };
    const fresh = newChat<NeedTurn>(now());
    return { ...f, chats: [fresh, ...chats], open: fresh.id };
  });
}

/** For the one caller that may run the search a chat's household just said yes to; undefined while one is under way. */
export function claimSearch(chat: string): SearchClaim | undefined {
  if (searching.has(chat) || chatIn(find, chat)?.need?.slot !== NeedSlot.done) return undefined;
  searching.add(chat);
  return { chat, generation };
}

/** A claimed search finished: true when its result still counts, nobody having signed out since. */
export function settleSearch(claim: SearchClaim): boolean {
  if (claim.generation !== generation) return false;
  searching.delete(claim.chat);
  return true;
}

/**
 * Reads the signed-in owner's Find chats from the phone. The newest opens when its need is not yet sent, so it carries
 * on where it was; otherwise a new chat opens, ready for the next need.
 */
export async function loadFind(ports: Owner): Promise<void> {
  const mine = ++generation;
  owner = undefined;
  searching.clear();
  const records = await loadChats(ports.storage, ChatShelf.find);
  if (mine !== generation) return;
  const chats = records.map(readFindChat);
  needTurnIdsSeen(Math.max(0, ...chats.flatMap((chat) => chat.turns.map((turn) => turn.id))));
  const newest = chats[0];
  owner = ports;
  // A worker chosen while the chats were being read (their QR link opened the app) keeps their chat open.
  const pending = chatIn(find, find.open);
  if (pending?.to && !saidIn(pending)) return show({ ready: true, chats: [pending, ...chats], open: pending.id });
  if (newest?.need) return show({ ready: true, chats, open: newest.id });
  const fresh = newChat<NeedTurn>(ports.clock.now());
  show({ ready: true, chats: [fresh, ...chats], open: fresh.id });
}

/** Signing out: the screen forgets the owner's chats; their records stay on the phone for when they sign in again. */
export function forgetFind(): void {
  generation += 1;
  owner = undefined;
  searching.clear();
  show(blank(new Date()));
}
