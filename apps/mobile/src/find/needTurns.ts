import type { Chat, Choice, Line } from "@gigsync/core";
import type { BoardWorker } from "@gigsync/protocol";

/**
 * What a Find chat holds, turn by turn: the agent's questions, the household's answers, and the workers a search found
 * with the ones picked, in the order they happened. The core keeps chats of any kind of turn; these are Find's.
 */

export const NeedSpeaker = { app: "app", owner: "owner", found: "found" } as const;
const SPEAKERS: ReadonlySet<string> = new Set(Object.values(NeedSpeaker));

export type NeedTurn =
  | {
      id: number;
      who: typeof NeedSpeaker.app;
      lines: readonly Line[];
      choices: readonly Choice[];
    }
  | { id: number; who: typeof NeedSpeaker.owner; text: string }
  /** What a search found, and the ones the owner picked to ask (the nearest, until they choose). */
  | { id: number; who: typeof NeedSpeaker.found; workers: readonly BoardWorker[]; picked: readonly string[] };

/** A found-workers turn. */
export type FoundTurn = Extract<NeedTurn, { who: typeof NeedSpeaker.found }>;

/** Turn ids are unique across every Find chat on screen. */
let lastId = 0;

/** Chats read back from the phone carry ids up to `max`; new turns are numbered after them. */
export function needTurnIdsSeen(max: number): void {
  lastId = Math.max(lastId, max);
}

export const ownerSaid = (text: string): NeedTurn => ({ id: ++lastId, who: NeedSpeaker.owner, text });
export const appSaid = (lines: readonly Line[], choices: readonly Choice[] = []): NeedTurn => ({
  id: ++lastId,
  who: NeedSpeaker.app,
  lines,
  choices,
});
export const foundSaid = (workers: readonly BoardWorker[], picked: readonly string[]): NeedTurn => ({
  id: ++lastId,
  who: NeedSpeaker.found,
  workers,
  picked,
});

/** The household's own words in a turn, for the chat's title: their answers, never the agent's questions. */
export const needWordsOf = (turn: NeedTurn): string | undefined =>
  turn.who === NeedSpeaker.owner ? turn.text : undefined;

/** The household said something in the chat: only then is it history, kept and listed (ADR 0035, Households). */
export const saidIn = (chat: Chat<NeedTurn>): boolean => chat.turns.some((turn) => needWordsOf(turn) !== undefined);

/** A turn read back from the phone's storage that has the shape this app writes; others are left out of the chat. */
export function isNeedTurn(value: unknown): value is NeedTurn {
  if (typeof value !== "object" || value === null || !("id" in value) || !("who" in value)) return false;
  if (typeof value.id !== "number" || typeof value.who !== "string" || !SPEAKERS.has(value.who)) return false;
  if (value.who === NeedSpeaker.app)
    return "lines" in value && Array.isArray(value.lines) && "choices" in value && Array.isArray(value.choices);
  if (value.who === NeedSpeaker.found)
    return "workers" in value && Array.isArray(value.workers) && "picked" in value && Array.isArray(value.picked);
  return "text" in value && typeof value.text === "string";
}
