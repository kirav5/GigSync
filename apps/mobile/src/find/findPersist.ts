import { type Chat, ChatShelf, type NeedMemory, NeedSlot, type NeedState, type Storage } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { needConfig } from "../card/choices.js";
import { keepChats } from "../chats/keep.js";
import type { Find, FindChat } from "./findChats.js";
import { isNeedTurn, type NeedTurn, saidIn } from "./needTurns.js";

/**
 * Find's chats on the phone, under their owner (ADR 0032, ADR 0035): each chat is one record, kept once the household
 * has said something in it and rewritten as it changes. A need not yet sent is kept in its chat's record, so it carries
 * on after a restart or the next sign-in. Its draft holds the budget, as typed; like the rest of the owner's records,
 * none of it leaves the phone.
 */

/** A need as kept: without the city's areas and rates, which are the app's own and rebuilt from the language. */
interface KeptNeed {
  own: Lang;
  /** The phone's day when the need was begun, for dates said without a year. */
  today: string;
  /** What the agent remembered when the need was begun, so a question offering it still reads the same. */
  remembered?: NeedMemory | undefined;
  state: Omit<NeedState, "config">;
}

/** A Find chat as kept on the phone: its turns, and its need until the workers are asked. */
interface KeptFindChat extends Chat<NeedTurn> {
  need?: KeptNeed | undefined;
}

const SLOTS: ReadonlySet<string> = new Set(Object.values(NeedSlot));
const LANGS: ReadonlySet<string> = new Set(Lang.options);

const hold = ({ config, ...state }: NeedState): KeptNeed => ({
  own: config.own,
  today: config.today,
  remembered: config.remembered,
  state,
});

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/** The worker a need is addressed to, as kept: their id, name and trades. */
const isTo = (value: unknown): boolean =>
  isObject(value) &&
  "user" in value &&
  typeof value.user === "string" &&
  "name" in value &&
  typeof value.name === "string" &&
  "trades" in value &&
  Array.isArray(value.trades);

function isKeptState(value: unknown): value is KeptNeed["state"] {
  if (!isObject(value)) return false;
  if (!("slot" in value && "draft" in value && "notes" in value && "ownAnswer" in value && "filled" in value))
    return false;
  if (!("changing" in value && "fresh" in value && "radius_km" in value)) return false;
  const estimate = "estimate" in value ? value.estimate : undefined;
  const to = "to" in value ? value.to : undefined;
  return (
    typeof value.slot === "string" &&
    SLOTS.has(value.slot) &&
    isObject(value.draft) &&
    "seen" in value.draft &&
    isObject(value.draft.seen) &&
    Array.isArray(value.notes) &&
    Array.isArray(value.ownAnswer) &&
    Array.isArray(value.filled) &&
    typeof value.changing === "boolean" &&
    typeof value.fresh === "boolean" &&
    typeof value.radius_km === "number" &&
    (estimate === undefined || isObject(estimate)) &&
    (to === undefined || isTo(to))
  );
}

function isKeptNeed(value: unknown): value is KeptNeed {
  if (!isObject(value) || !("own" in value && "today" in value && "state" in value)) return false;
  const remembered = "remembered" in value ? value.remembered : undefined;
  return (
    typeof value.own === "string" &&
    LANGS.has(value.own) &&
    typeof value.today === "string" &&
    (remembered === undefined || isObject(remembered)) &&
    isKeptState(value.state)
  );
}

/** A chat read back from the phone: its turns of the shape this app writes, and its need if it was not yet sent. */
export function readFindChat(record: Chat<unknown>): FindChat {
  const held = "need" in record ? record.need : undefined;
  const { v, id, title, started_at, updated_at } = record;
  const chat: FindChat = { v, id, title, started_at, updated_at, turns: record.turns.filter(isNeedTurn) };
  if (!isKeptNeed(held)) return chat;
  const config = { ...needConfig(held.own, held.today), ...(held.remembered ? { remembered: held.remembered } : {}) };
  return { ...chat, need: { ...held.state, config } };
}

/** Keeps on `storage` (the owner's) what changed between two states of Find: chats changed, or gone. */
export function keepFindChanges(storage: Storage, prev: Find, next: Find): void {
  keepChats(storage, ChatShelf.find, prev.chats, next.chats, {
    recordOf: (chat): KeptFindChat | undefined =>
      saidIn(chat) ? { ...chat, need: chat.need && hold(chat.need) } : undefined,
  });
}
