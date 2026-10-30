import type { Card, Choice, Line } from "@gigsync/core";
import type { EstimateSource } from "@gigsync/protocol";
import { isMoveTurn, type MoveTurn } from "./moveTurns.js";

/**
 * What a Talk chat holds, turn by turn: notes to the agent with their answers, the card interview's questions and the
 * owner's answers, and a move to a new city (`moveTurns.ts`), in the order they happened. The core keeps chats of any
 * kind of turn; these are Talk's.
 */

/** Who a turn is from: the interview asking or telling, the owner answering it, or the owner's note to the agent. */
export const Speaker = { app: "app", owner: "owner", note: "note" } as const;
const SPEAKERS: ReadonlySet<string> = new Set(Object.values(Speaker));

export type Turn =
  | {
      id: number;
      who: typeof Speaker.app;
      lines: readonly Line[];
      choices: readonly Choice[];
      /** The pages an estimate in `lines` rests on. */
      sources?: readonly EstimateSource[] | undefined;
    }
  | { id: number; who: typeof Speaker.owner; text: string }
  /** A note and, once the agent has answered, its card. */
  | { id: number; who: typeof Speaker.note; text: string; card?: Card }
  | MoveTurn;

/** Turn ids are unique across every chat on screen, so an answer finds its note wherever the owner went since. */
let lastId = 0;

/** Chats read back from the phone carry ids up to `max`; new turns are numbered after them. */
export function turnIdsSeen(max: number): void {
  lastId = Math.max(lastId, max);
}

/** The next turn id, for a turn of any kind. */
export const nextTurnId = (): number => ++lastId;
export const ownerTurn = (text: string): Turn => ({ id: ++lastId, who: Speaker.owner, text });
export const noteTurn = (text: string): Turn => ({ id: ++lastId, who: Speaker.note, text });
export const appTurn = (
  lines: readonly Line[],
  choices: readonly Choice[] = [],
  sources?: readonly EstimateSource[],
): Turn => ({ id: ++lastId, who: Speaker.app, lines, choices, sources });

/** The owner's own words in a turn, for the chat's title: their answers and notes, never the agent's. */
export const wordsOf = (turn: Turn): string | undefined =>
  turn.who === Speaker.owner || turn.who === Speaker.note ? turn.text : undefined;

/** A turn read back from the phone's storage that has the shape this app writes; others are left out of the chat. */
export function isTurn(value: unknown): value is Turn {
  if (typeof value !== "object" || value === null || !("id" in value) || !("who" in value)) return false;
  if (isMoveTurn(value)) return true;
  if (typeof value.id !== "number" || typeof value.who !== "string" || !SPEAKERS.has(value.who)) return false;
  if (value.who === Speaker.app)
    return "lines" in value && Array.isArray(value.lines) && "choices" in value && Array.isArray(value.choices);
  return "text" in value && typeof value.text === "string";
}
