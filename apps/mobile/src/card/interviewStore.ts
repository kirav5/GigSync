import {
  type Card,
  type Choice,
  choose,
  hear,
  type InterviewConfig,
  type InterviewState,
  type Line,
  prompt,
  Slot,
  withConfig,
} from "@gigsync/core";
import { useSyncExternalStore } from "react";

/**
 * Talk's conversation, kept outside any screen so it survives switching tabs: notes to the agent with their answers,
 * and the card interview's questions and answers, in one list in the order they happened. The owner can look at
 * Profile mid-interview and come back to the same question. It does not survive an app restart; the questions are
 * short enough to answer again. A new interview adds to the conversation; the interview is over once the card is
 * published, or closed when the My card form publishes instead (its draft would be stale, and holds the lowest rate),
 * with the words already on screen left there. Signing out wipes all of it (it belongs to the owner alone).
 */

/** Who a turn is from: the interview asking or telling, the owner answering it, or the owner's note to the agent. */
export const Speaker = { app: "app", owner: "owner", note: "note" } as const;

export type Turn =
  | { id: number; who: typeof Speaker.app; lines: readonly Line[]; choices: readonly Choice[] }
  | { id: number; who: typeof Speaker.owner; text: string }
  /** A note and, once the agent has answered, its card. */
  | { id: number; who: typeof Speaker.note; text: string; card?: Card };

/** Talk keeps this many turns; older ones are dropped first. */
const MAX_TURNS = 100;

export interface InterviewSnapshot {
  /** The interview being answered; undefined before one starts and after it ends. */
  state?: InterviewState;
  turns: readonly Turn[];
  /** "Later": the interview waits, and Talk offers to carry on. */
  paused: boolean;
}

let snapshot: InterviewSnapshot = { turns: [], paused: false };
/** The interview at confirm, from just before the yes that sent the card, to go back to if publishing fails. */
let beforeDone: InterviewState | undefined;
/** A publish is under way; Talk may be left and opened again meanwhile, and must not send the card twice. */
let sending = false;
/** Counts closed and wiped interviews: a publish that finishes after its interview was closed or wiped changes nothing. */
let round = 0;
let lastId = 0;
const listeners = new Set<() => void>();

function set(next: InterviewSnapshot): void {
  snapshot = next.turns.length > MAX_TURNS ? { ...next, turns: next.turns.slice(-MAX_TURNS) } : next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const owner = (text: string): Turn => ({ id: ++lastId, who: Speaker.owner, text });
const app = (lines: readonly Line[], choices: readonly Choice[] = []): Turn => ({
  id: ++lastId,
  who: Speaker.app,
  lines,
  choices,
});

/** The question a state asks, as a turn; none once the owner has said yes to publishing. */
const asked = (state: InterviewState): Turn[] => {
  if (state.slot === Slot.done) return [];
  const p = prompt(state);
  return [app(p.lines, p.choices ?? [])];
};

export function useInterview(): InterviewSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/**
 * Starts an interview in place of any other, after everything already said; `said` is the owner's words that asked
 * for it, shown first.
 */
export function beginInterview(state: InterviewState, said?: string): void {
  set({ state, paused: false, turns: [...snapshot.turns, ...(said ? [owner(said)] : []), ...asked(state)] });
}

/** A note to the agent, shown at once; returns its id, for the answer. */
export function addNote(text: string): number {
  const turn: Turn = { id: ++lastId, who: Speaker.note, text };
  set({ ...snapshot, turns: [...snapshot.turns, turn] });
  return turn.id;
}

/** The agent's answer to note `id`; nothing when the note is gone (signed out since, or dropped as old). */
export function noteAnswered(id: number, card: Card): void {
  if (!snapshot.turns.some((turn) => turn.id === id)) return;
  set({
    ...snapshot,
    turns: snapshot.turns.map((turn) => (turn.id === id && turn.who === Speaker.note ? { ...turn, card } : turn)),
  });
}

function answered(next: InterviewState, label: string): void {
  const { state, turns } = snapshot;
  if (!state || next === state) return;
  if (next.slot === Slot.done) beforeDone = state;
  set({ ...snapshot, state: next, turns: [...turns, owner(label), ...asked(next)] });
}

/** An answer in words: `aloud` when spoken, false when typed (a typed lowest rate is never read back aloud). */
export function answerInterview(text: string, aloud: boolean): void {
  if (snapshot.state) answered(hear(snapshot.state, text, aloud), text);
}

/** An answer by tapping a choice; `label` is the choice as the owner read it. */
export function tapInterview(value: string, label: string): void {
  if (snapshot.state) answered(choose(snapshot.state, value), label);
}

export function pauseInterview(): void {
  if (snapshot.state) set({ ...snapshot, paused: true });
}

/** "Carry on": when notes came after the open question, it is asked again below them. */
export function resumeInterview(): void {
  const { state, turns } = snapshot;
  if (!state) return;
  const last = turns.at(-1);
  set({ ...snapshot, paused: false, turns: last?.who === Speaker.app ? turns : [...turns, ...asked(state)] });
}

/**
 * The owner changed the app's language: the question now open is asked again in it, and the questions after it and
 * the words the recognizer expects follow it. Lines already shown name trades and areas by catalog key, so they
 * re-render in the new language by themselves.
 */
export function relanguageInterview(config: InterviewConfig): void {
  const { state, turns } = snapshot;
  if (!state || state.config.own === config.own) return;
  if (beforeDone) beforeDone = withConfig(beforeDone, config);
  const next = withConfig(state, config);
  set({ ...snapshot, state: next, turns: [...turns, ...asked(next)] });
}

/** Drops the interview's draft (it holds the lowest rate), so a publish still on its way lands nowhere. */
function forgetDraft(): void {
  round += 1;
  beforeDone = undefined;
  sending = false;
}

/** Ends the interview without its card, after the My card form publishes or unlists; the words already shown stay. */
export function closeInterview(): void {
  forgetDraft();
  set({ turns: snapshot.turns, paused: false });
}

/** Wipes the interview and the whole conversation: at sign-out. */
export function endInterview(): void {
  forgetDraft();
  set({ turns: [], paused: false });
}

/**
 * For the one caller that may publish the card the owner just said yes to: a claim to hand back with the outcome.
 * Undefined while a publish is under way or before the yes.
 */
export function claimPublish(): number | undefined {
  if (sending || snapshot.state?.slot !== Slot.done) return undefined;
  sending = true;
  return round;
}

/**
 * The card is on the board: the interview is over, and its last word stays on screen. False when the interview was
 * closed or wiped while the card was on its way, so the caller tells nobody.
 */
export function interviewPublished(claim: number, line: Line): boolean {
  if (claim !== round) return false;
  beforeDone = undefined;
  sending = false;
  set({ turns: [...snapshot.turns, app([line])], paused: false });
  return true;
}

/** Publishing failed: say so, and stand at confirm again so a yes can retry. */
export function interviewFailed(claim: number, line: Line): void {
  if (claim !== round) return;
  sending = false;
  const back = beforeDone;
  if (!back) return;
  const p = prompt(back);
  set({ ...snapshot, state: back, turns: [...snapshot.turns, app([line, ...p.lines], p.choices ?? [])] });
}
