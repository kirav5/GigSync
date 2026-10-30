import {
  type Chat,
  type InterviewState,
  loadChats,
  MAX_CHATS,
  newChat,
  type Ports,
  pruneChats,
  Slot,
  withTurns,
} from "@gigsync/core";
import { useSyncExternalStore } from "react";
import { keepChanges, readChat } from "./persist.js";
import { type Turn, turnIdsSeen, wordsOf } from "./turns.js";

/**
 * Talk's chats, kept outside any screen so they survive switching tabs, and on the phone under their owner so they
 * survive a restart and signing out and in (ADR 0035). One chat is open on screen; "New chat" keeps it in the list and
 * opens an empty one; the owner can open any chat again and carry on in it, or delete it. At most one card interview
 * is live, and it belongs to the chat it started in: leaving that chat pauses it there, to carry on from there. Signing
 * out clears the screen and keeps the records; whoever signs in next reads only their own.
 */

/** The card interview, open or waiting in its chat. */
export interface LiveInterview {
  /** Numbers interviews: a publish that finishes after its interview ended (closed, deleted, replaced) changes nothing. */
  id: number;
  /** The chat it started in, and belongs to. */
  chat: string;
  state: InterviewState;
  /** "Later", or the owner went to another chat: it waits for "Carry on". */
  paused: boolean;
  /** The interview at confirm, from just before the yes that sent the card, to go back to if publishing fails. */
  beforeDone?: InterviewState | undefined;
  /** A publish is under way; Talk may be left and opened again meanwhile, and must not send the card twice. */
  sending: boolean;
}

export interface Talk {
  /** The owner's chats have been read from the phone. */
  ready: boolean;
  /** Every chat, the open one included even while it is empty. */
  chats: readonly Chat<Turn>[];
  open: string;
  live?: LiveInterview | undefined;
}

/** What the screens read: the open chat, its interview if it holds the live one, and the list. */
export interface TalkView {
  ready: boolean;
  open: string;
  turns: readonly Turn[];
  /** The interview being answered in the open chat; undefined when there is none, or it is another chat's. */
  state?: InterviewState | undefined;
  /** The open chat's interview waits for "Carry on". */
  paused: boolean;
  /** The chat holding the live card interview, open or not. */
  interviewIn?: string | undefined;
  chats: readonly Chat<Turn>[];
}

type Owner = Pick<Ports, "storage" | "clock">;

const blank = (now: Date): Talk => {
  const chat = newChat<Turn>(now);
  return { ready: false, chats: [chat], open: chat.id };
};

let talk: Talk = blank(new Date());
/** The signed-in owner's storage and clock; undefined while signed out or loading. */
let owner: Owner | undefined;
/** Counts loads and sign-outs: a load that finishes after the next one began, or after signing out, is dropped. */
let generation = 0;
let interviews = 0;
const listeners = new Set<() => void>();

export const turnsIn = (t: Talk, chat: string): readonly Turn[] => t.chats.find((c) => c.id === chat)?.turns ?? [];
export const liveInOpen = (t: Talk): LiveInterview | undefined => (t.live?.chat === t.open ? t.live : undefined);
export const currentTalk = (): Talk => talk;
export const talkGeneration = (): number => generation;
export const nextInterviewId = (): number => ++interviews;
const now = (): Date => owner?.clock.now() ?? new Date();

function viewOf(t: Talk): TalkView {
  const live = liveInOpen(t);
  return {
    ready: t.ready,
    open: t.open,
    turns: turnsIn(t, t.open),
    state: live?.state,
    paused: live?.paused ?? false,
    interviewIn: t.live?.chat,
    chats: t.chats,
  };
}
let view: TalkView = viewOf(talk);

function show(next: Talk): void {
  talk = next;
  view = viewOf(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTalk(): TalkView {
  return useSyncExternalStore(subscribe, () => view);
}

/** Changes Talk: past the cap the oldest chats go (never the open one or the interview's), and the change is kept. */
export function updateTalk(change: (t: Talk) => Talk): void {
  const prev = talk;
  let next = change(prev);
  if (next === prev) return;
  if (next.chats.length > MAX_CHATS) {
    const keep = new Set([next.open, ...(next.live ? [next.live.chat] : [])]);
    next = { ...next, chats: pruneChats(next.chats, keep).kept };
  }
  if (owner) keepChanges(owner.storage, prev, next);
  show(next);
}

/** `t` with chat `chat`'s turns now `turns`; titled from the owner's first words, the newest kept past the cap. */
export function withChatTurns(t: Talk, chat: string, turns: readonly Turn[]): Talk {
  const at = now();
  return { ...t, chats: t.chats.map((c) => (c.id === chat ? withTurns(c, turns, at, wordsOf) : c)) };
}

/**
 * Leaving the open chat: an unfinished interview in it waits there for "Carry on", and an empty chat goes, since
 * nothing was said in it.
 */
function leave(t: Talk): Talk {
  const live = liveInOpen(t);
  const waiting = live && live.state.slot !== Slot.done ? { ...live, paused: true } : t.live;
  const empty = turnsIn(t, t.open).length === 0;
  return { ...t, live: waiting, chats: empty ? t.chats.filter((c) => c.id !== t.open) : t.chats };
}

/** "New chat": the open chat stays in the list, and an empty one opens; nothing happens while the open one is empty. */
export function startChat(): void {
  updateTalk((t) => {
    if (turnsIn(t, t.open).length === 0) return t;
    const chat = newChat<Turn>(now());
    const left = leave(t);
    return { ...left, chats: [chat, ...left.chats], open: chat.id };
  });
}

/** Opens a chat from the list, to read it and carry on in it. */
export function openChat(id: string): void {
  updateTalk((t) => (t.open === id || !t.chats.some((c) => c.id === id) ? t : { ...leave(t), open: id }));
}

/** The owner deletes a chat: gone from the phone, with its card interview; deleting the open one opens an empty one. */
export function removeChat(id: string): void {
  updateTalk((t) => {
    if (!t.chats.some((c) => c.id === id)) return t;
    const chats = t.chats.filter((c) => c.id !== id);
    const live = t.live?.chat === id ? undefined : t.live;
    if (t.open !== id) return { ...t, chats, live };
    const fresh = newChat<Turn>(now());
    return { ...t, chats: [fresh, ...chats], open: fresh.id, live };
  });
}

/**
 * Reads the signed-in owner's chats from the phone and opens the newest; their card interview comes back in the chat
 * it belongs to, as it was left.
 */
export async function loadTalk(ports: Owner): Promise<void> {
  const mine = ++generation;
  owner = undefined;
  const records = await loadChats(ports.storage);
  if (mine !== generation) return;
  const read = records.map(readChat);
  turnIdsSeen(Math.max(0, ...read.flatMap(({ chat }) => chat.turns.map((turn) => turn.id))));
  // Newest first, so the newest copy wins should two records ever hold an interview.
  const holder = read.find((r) => r.interview);
  const live = holder?.interview && { ...holder.interview, id: ++interviews, chat: holder.chat.id, sending: false };
  const chats = read.map(({ chat }) => chat);
  const fresh = newChat<Turn>(ports.clock.now());
  owner = ports;
  show({ ready: true, chats: chats.length > 0 ? chats : [fresh], open: chats[0]?.id ?? fresh.id, live });
}

/** Signing out: the screen forgets the owner's chats; their records stay on the phone for when they sign in again. */
export function forgetTalk(): void {
  generation += 1;
  owner = undefined;
  show(blank(new Date()));
}
