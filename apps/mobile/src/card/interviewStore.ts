import {
  type Card,
  cardEstimate,
  choose,
  type FoundEstimate,
  hear,
  type InterviewConfig,
  type InterviewState,
  type Line,
  prompt,
  Slot,
  withConfig,
  withEstimate,
} from "@gigsync/core";
import {
  currentTalk,
  type LiveInterview,
  liveInOpen,
  nextInterviewId,
  type Talk,
  talkGeneration,
  turnsIn,
  updateTalk,
  withChatTurns,
} from "../talk/talkStore.js";
import { appTurn, noteTurn, ownerTurn, Speaker, type Turn } from "../talk/turns.js";

/**
 * What is said on Talk, turn by turn, in the chat it is said in (`talk/talkStore.ts` keeps the chats): notes to the
 * agent with their answers, and the card interview's questions and answers. The interview is over once the card is
 * published, or closed when the My card form publishes instead (its draft would be stale, and holds the lowest rate).
 */

/** The question a state asks, as a turn; none once the owner has said yes to publishing. */
const asked = (state: InterviewState): Turn[] => {
  if (state.slot === Slot.done) return [];
  const p = prompt(state);
  return [appTurn(p.lines, p.choices ?? [], p.sources)];
};

/** `t` with turns added to the end of chat `chat`. */
const adding = (t: Talk, chat: string, ...turns: readonly Turn[]): Talk =>
  withChatTurns(t, chat, [...turnsIn(t, chat), ...turns]);

/** Changes the live interview, when it is the open chat's: the one the owner is answering. */
function inOpen(change: (t: Talk, live: LiveInterview) => Talk): void {
  updateTalk((t) => {
    const live = liveInOpen(t);
    return live ? change(t, live) : t;
  });
}

/**
 * Starts an interview in the open chat, in place of any other (that one's chat keeps what was said), after
 * everything already said; `said` is the owner's words that asked for it, shown first. Not while a card is being sent.
 */
export function beginInterview(state: InterviewState, said?: string): void {
  updateTalk((t) => {
    if (t.live?.sending) return t;
    const live: LiveInterview = { id: nextInterviewId(), chat: t.open, state, paused: false, sending: false };
    return { ...adding(t, t.open, ...(said ? [ownerTurn(said)] : []), ...asked(state)), live };
  });
}

/** Where a note was written, for its answer: the agent may answer after the owner opened another chat. */
export interface NoteRef {
  generation: number;
  chat: string;
  id: number;
}

/** A note to the agent in the open chat, shown at once. */
export function addNote(text: string): NoteRef {
  const turn = noteTurn(text);
  const chat = currentTalk().open;
  updateTalk((t) => adding(t, chat, turn));
  return { generation: talkGeneration(), chat, id: turn.id };
}

/** The agent's answer to a note; nothing when the note is gone (its chat deleted, signed out since, dropped as old). */
export function noteAnswered(note: NoteRef, card: Card): void {
  if (note.generation !== talkGeneration()) return;
  updateTalk((t) => {
    const turns = turnsIn(t, note.chat);
    if (!turns.some((turn) => turn.id === note.id)) return t;
    const answered = turns.map((turn) => (turn.id === note.id && turn.who === Speaker.note ? { ...turn, card } : turn));
    return withChatTurns(t, note.chat, answered);
  });
}

function answered(next: (state: InterviewState) => InterviewState, label: string): void {
  inOpen((t, live) => {
    const state = next(live.state);
    if (state === live.state) return t;
    const beforeDone = state.slot === Slot.done ? live.state : live.beforeDone;
    return { ...adding(t, live.chat, ownerTurn(label), ...asked(state)), live: { ...live, state, beforeDone } };
  });
}

/** An answer in words: `aloud` when spoken, false when typed (a typed lowest rate is never read back aloud). */
export function answerInterview(text: string, aloud: boolean): void {
  answered((state) => hear(state, text, aloud), text);
}

/** An answer by tapping a choice; `label` is the choice as the owner read it. */
export function tapInterview(value: string, label: string): void {
  answered((state) => choose(state, value), label);
}

export function pauseInterview(): void {
  inOpen((t, live) => ({ ...t, live: { ...live, paused: true } }));
}

/** "Carry on": when notes came after the open question, it is asked again below them. */
export function resumeInterview(): void {
  inOpen((t, live) => {
    const last = turnsIn(t, live.chat).at(-1);
    const again = last?.who === Speaker.app ? t : adding(t, live.chat, ...asked(live.state));
    return { ...again, live: { ...live, paused: false } };
  });
}

/**
 * The owner changed the app's language: the question now open is asked again in it, and the questions after it and
 * the words the recognizer expects follow it. Lines already shown name trades and areas by catalog key, so they
 * re-render in the new language by themselves.
 */
export function relanguageInterview(config: InterviewConfig): void {
  inOpen((t, live) => {
    if (live.state.config.own === config.own) return t;
    const state = withConfig(live.state, config);
    const beforeDone = live.beforeDone && withConfig(live.beforeDone, config);
    return { ...adding(t, live.chat, ...asked(state)), live: { ...live, state, beforeDone } };
  });
}

/**
 * The rate estimate for the worker's first trade arrived (or none did). A rate question already on screen, with
 * nothing said after it, shows it in place, so the range and the suggested amount appear without a second question.
 */
export function interviewEstimate(found: FoundEstimate | undefined): void {
  updateTalk((t) => {
    const live = t.live;
    if (!live || live.state.estimate === found) return t;
    const state = withEstimate(live.state, found);
    const turns = turnsIn(t, live.chat);
    const last = turns.at(-1);
    const open = (state.slot === Slot.rate || state.slot === Slot.min) && state.pending === undefined;
    if (!open || last?.who !== Speaker.app || cardEstimate(state) === cardEstimate(live.state))
      return { ...t, live: { ...live, state } };
    const p = prompt(state);
    const shown: Turn = { ...last, lines: p.lines, choices: p.choices ?? [], sources: p.sources };
    return { ...withChatTurns(t, live.chat, [...turns.slice(0, -1), shown]), live: { ...live, state } };
  });
}

/**
 * Ends the interview without its card, after the My card form publishes or unlists. Its questions and answers go from
 * its chat, since the card was made another way and they would only stand there unanswered; the owner's notes stay.
 */
export function closeInterview(): void {
  updateTalk((t) => {
    if (!t.live) return t;
    const notes = turnsIn(t, t.live.chat).filter((turn) => turn.who === Speaker.note);
    return { ...withChatTurns(t, t.live.chat, notes), live: undefined };
  });
}

/**
 * For the one caller that may publish the card the owner just said yes to: a claim to hand back with the outcome.
 * Undefined while a publish is under way or before the yes.
 */
export function claimPublish(): number | undefined {
  const live = currentTalk().live;
  if (!live || live.sending || live.state.slot !== Slot.done) return undefined;
  updateTalk((t) => ({ ...t, live: { ...live, sending: true } }));
  return live.id;
}

/**
 * The card is on the board: the interview is over, and its last word stays in its chat. False when the interview was
 * closed, deleted or signed out of while the card was on its way, so the caller tells nobody.
 */
export function interviewPublished(claim: number, line: Line): boolean {
  const live = currentTalk().live;
  if (live?.id !== claim) return false;
  updateTalk((t) => ({ ...adding(t, live.chat, appTurn([line])), live: undefined }));
  return true;
}

/** Publishing failed: say so, and stand at confirm again so a yes can retry. */
export function interviewFailed(claim: number, line: Line): void {
  updateTalk((t) => {
    const live = t.live;
    if (live?.id !== claim) return t;
    const back = live.beforeDone;
    if (!back) return { ...t, live: { ...live, sending: false } };
    const p = prompt(back);
    const said = adding(t, live.chat, appTurn([line, ...p.lines], p.choices ?? []));
    return { ...said, live: { ...live, state: back, sending: false } };
  });
}
