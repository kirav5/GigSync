import {
  type Choice,
  chooseNeed,
  chooseNeedDate,
  type FoundEstimate,
  hearNeed,
  type Line,
  MAX_ASK,
  type MessageKey,
  type NeedConfig,
  type NeedHint,
  NeedSlot,
  type NeedState,
  needEstimate,
  needPrompt,
  needWithConfig,
  needWithEstimate,
  searchedNeed,
  searchFailed,
} from "@gigsync/core";
import type { BoardWorker, EstimateSource } from "@gigsync/protocol";
import { useSyncExternalStore } from "react";

/**
 * Find's conversation, kept outside any screen so it survives switching tabs, like Talk's (`card/interviewStore.ts`):
 * the questions, the owner's answers, and the workers a search found with the ones picked. Whether Find shows the chat
 * or the form is kept here too. A new need starts a new conversation; signing out wipes it all (the budget is in it).
 */

export const NeedSpeaker = { app: "app", owner: "owner", found: "found" } as const;

export type NeedTurn =
  | {
      id: number;
      who: typeof NeedSpeaker.app;
      lines: readonly Line[];
      choices: readonly Choice[];
      /** The pages an estimate in `lines` rests on. */
      sources?: readonly EstimateSource[] | undefined;
    }
  | { id: number; who: typeof NeedSpeaker.owner; text: string }
  /** What a search found, and the ones the owner picked to ask (the nearest, until they choose). */
  | { id: number; who: typeof NeedSpeaker.found; workers: readonly BoardWorker[]; picked: readonly string[] };

/** Find as a conversation, or as the form some owners prefer. */
export const FindMode = { chat: "chat", form: "form" } as const;
export type FindMode = (typeof FindMode)[keyof typeof FindMode];

export interface NeedSnapshot {
  /** The need being asked about; undefined before the first question and once the workers were asked. */
  state?: NeedState | undefined;
  turns: readonly NeedTurn[];
  mode: FindMode;
}

let snapshot: NeedSnapshot = { turns: [], mode: FindMode.chat };
/** A search is under way; Find may be left and opened again meanwhile, and must not search twice. */
let searching = false;
/** Counts wiped conversations: a search that finishes after a sign-out changes nothing. */
let round = 0;
let lastId = 0;
const listeners = new Set<() => void>();

function set(next: NeedSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const owner = (text: string): NeedTurn => ({ id: ++lastId, who: NeedSpeaker.owner, text });
const app = (
  lines: readonly Line[],
  choices: readonly Choice[] = [],
  sources?: readonly EstimateSource[],
): NeedTurn => ({ id: ++lastId, who: NeedSpeaker.app, lines, choices, sources });

/** The question a state asks, as a turn; none while the found workers are on screen. */
function asked(state: NeedState): NeedTurn[] {
  if (state.slot === NeedSlot.found) return [];
  const p = needPrompt(state);
  return [app(p.lines, p.choices ?? [], p.sources)];
}

export function useNeed(): NeedSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** A new conversation about a new need, in place of the last one. */
export function beginNeed(state: NeedState): void {
  set({ ...snapshot, state, turns: asked(state) });
}

function moved(next: NeedState, said: NeedTurn[]): void {
  const { state, turns } = snapshot;
  if (!state) return;
  set({ ...snapshot, state: next, turns: [...turns, ...said, ...(next === state ? [] : asked(next))] });
}

/** The owner's words on screen at once, while a model reads them; `answerNeed` follows with `shown`. */
export function showOwner(text: string): void {
  set({ ...snapshot, turns: [...snapshot.turns, owner(text)] });
}

/**
 * An answer in words: `aloud` when spoken (a typed budget is never read back aloud); `hint` what a model read from
 * them, already checked; `shown` when `showOwner` put the words on screen already.
 */
export function answerNeed(text: string, aloud: boolean, hint: NeedHint = {}, shown = false): void {
  const { state } = snapshot;
  if (state) moved(hearNeed(state, text, aloud, hint), shown ? [] : [owner(text)]);
}

/** An answer by tapping a choice; `label` is the choice as the owner read it. */
export function tapNeed(value: string, label: string): void {
  const { state } = snapshot;
  if (state) moved(chooseNeed(state, value), [owner(label)]);
}

/** A date picked on the calendar at the When question; `label` is the date as the owner reads it. */
export function pickNeedDate(day: string, label: string): void {
  const { state } = snapshot;
  if (state) moved(chooseNeedDate(state, day), [owner(label)]);
}

/** The owner changed the app's language: the questions from here on follow it; lines shown re-render by themselves. */
export function relanguageNeed(config: NeedConfig): void {
  const { state } = snapshot;
  if (state && state.config.own !== config.own) set({ ...snapshot, state: needWithConfig(state, config) });
}

/**
 * The rate estimate for the job as described arrived (or none did). A budget question already on screen, with nothing
 * said after it, shows it in place, so the range and the suggested budget appear before the owner answers.
 */
export function needEstimateFound(found: FoundEstimate | undefined): void {
  const { state, turns } = snapshot;
  if (!state || state.estimate === found) return;
  const next = needWithEstimate(state, found);
  const last = turns.at(-1);
  if (next.slot !== NeedSlot.budget || last?.who !== NeedSpeaker.app || needEstimate(next) === needEstimate(state)) {
    set({ ...snapshot, state: next });
    return;
  }
  const p = needPrompt(next);
  const shown: NeedTurn = { ...last, lines: p.lines, choices: p.choices ?? [], sources: p.sources };
  set({ ...snapshot, state: next, turns: [...turns.slice(0, -1), shown] });
}

/** For the one caller that may run the search the owner just said yes to; undefined while one is under way. */
export function claimSearch(): number | undefined {
  if (searching || snapshot.state?.slot !== NeedSlot.done) return undefined;
  searching = true;
  return round;
}

/** What the search found: the workers to pick from, the nearest picked, or nobody and ways to look further. */
export function needFound(claim: number, workers: readonly BoardWorker[]): void {
  if (claim !== round) return;
  searching = false;
  const { state, turns } = snapshot;
  if (!state) return;
  const next = searchedNeed(state, workers.length);
  const found: NeedTurn[] = workers.length
    ? [
        app([{ key: "need.found" }]),
        { id: ++lastId, who: NeedSpeaker.found, workers, picked: workers.slice(0, 1).map((w) => w.user) },
      ]
    : asked(next);
  set({ ...snapshot, state: next, turns: [...turns, ...found] });
}

/** The search did not finish: say why, and stand at the readback so a yes searches again. */
export function needSearchFailed(claim: number, key: MessageKey): void {
  if (claim !== round) return;
  searching = false;
  const { state } = snapshot;
  if (state) moved(searchFailed(state, { key }), []);
}

/** Ticks or unticks a worker in a search's results; a fourth stays unticked. */
export function togglePick(turnId: number, user: string): void {
  const turns = snapshot.turns.map((turn) => {
    if (turn.id !== turnId || turn.who !== NeedSpeaker.found) return turn;
    const on = turn.picked.includes(user);
    if (!on && turn.picked.length >= MAX_ASK) return turn;
    return { ...turn, picked: on ? turn.picked.filter((u) => u !== user) : [...turn.picked, user] };
  });
  set({ ...snapshot, turns });
}

/** A line from the app below the conversation: why asking failed. */
export function needSay(line: Line): void {
  set({ ...snapshot, turns: [...snapshot.turns, app([line])] });
}

/** The workers were asked: the need is over, and its last word stays until the next need begins. */
export function needAsked(line: Line): void {
  set({ ...snapshot, state: undefined, turns: [...snapshot.turns, app([line])] });
}

export function setFindMode(mode: FindMode): void {
  set({ ...snapshot, mode });
}

/** Starts the conversation again with nothing in it; a search still under way changes nothing. */
function wipe(mode: FindMode): void {
  round += 1;
  searching = false;
  set({ turns: [], mode });
}

/** "New chat": the conversation starts again, in the mode the owner chose. */
export function restartNeed(): void {
  wipe(snapshot.mode);
}

/** Wipes the conversation, at sign-out: the next owner starts on the chat with nothing in it. */
export function endNeed(): void {
  wipe(FindMode.chat);
}
