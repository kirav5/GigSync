import {
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
 * The card interview in progress and the turns shown so far, kept outside any screen so it survives switching tabs:
 * the owner can look at Profile mid-interview and come back to the same question. It does not survive an app restart;
 * the questions are short enough to answer again. Over once the card is published, and wiped when the My card form
 * publishes instead (its answers would be stale) or the owner signs out (they belong to them alone).
 */

/** Who a turn is from: the app asking or telling, or the owner answering. */
export const Speaker = { app: "app", owner: "owner" } as const;

export type Turn =
  | { id: number; who: typeof Speaker.app; lines: readonly Line[]; choices: readonly Choice[] }
  | { id: number; who: typeof Speaker.owner; text: string };

export interface InterviewSnapshot {
  /** The interview being answered; undefined before one starts and after the card is published. */
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
/** Counts wiped interviews: a publish that finishes after its interview was wiped (a sign-out) changes nothing. */
let round = 0;
let lastId = 0;
const listeners = new Set<() => void>();

function set(next: InterviewSnapshot): void {
  snapshot = next;
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

/** Starts an interview, replacing any other; `said` is the owner's words that asked for it, shown first. */
export function beginInterview(state: InterviewState, said?: string): void {
  set({ state, paused: false, turns: [...(said ? [owner(said)] : []), ...asked(state)] });
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

export function resumeInterview(): void {
  if (snapshot.state) set({ ...snapshot, paused: false });
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

/** Wipes the interview and everything said in it: after the My card form publishes, and at sign-out. */
export function endInterview(): void {
  round += 1;
  beforeDone = undefined;
  sending = false;
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
 * wiped while the card was on its way, so the caller tells nobody.
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
