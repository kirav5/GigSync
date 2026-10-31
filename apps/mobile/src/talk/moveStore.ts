import type { Line, ListingDraft } from "@gigsync/core";
import type { City, MentorProfile, Trade, UserId } from "@gigsync/protocol";
import { type ActChoice, MoveSpeaker, type MoveTurn } from "./moveTurns.js";
import { currentTalk, talkGeneration, turnsIn, updateTalk, withChatTurns } from "./talkStore.js";
import { nextTurnId, type Turn } from "./turns.js";

/**
 * Where a move's answers land: the chat the owner was in when they asked, found again by id when the answer comes
 * (they may have opened another chat since), and dropped when that chat is gone or they signed out meanwhile. What the
 * chat is about is read back from its own turns: the newest move names the city, the newest outlook the trades.
 */

/** A chat an answer belongs to, and the sign-in it was asked under. */
export interface ChatRef {
  chat: string;
  generation: number;
}

/** A word or question from the agent, with its tap answers and, for the listing's questions, the draft so far. */
export const agentSays = (lines: readonly Line[], choices: readonly ActChoice[] = [], draft?: ListingDraft): Turn => ({
  id: nextTurnId(),
  who: MoveSpeaker.agent,
  lines,
  choices,
  draft,
});

/** The chat open now. */
export const openRef = (): ChatRef => ({ chat: currentTalk().open, generation: talkGeneration() });

/** The turns of the chat, as they stand now. */
export const turnsOf = (ref: ChatRef): readonly Turn[] => turnsIn(currentTalk(), ref.chat);

/** Adds turns to the end of the chat; nothing when it is gone or the owner signed out since. */
export function say(ref: ChatRef, ...turns: readonly Turn[]): void {
  if (ref.generation !== talkGeneration()) return;
  updateTalk((t) => {
    if (!t.chats.some((c) => c.id === ref.chat)) return t;
    return withChatTurns(t, ref.chat, [...turnsIn(t, ref.chat), ...turns]);
  });
}

/** Puts `turn` in place of the turn with its id: a question whose picked chips changed. */
export function replace(ref: ChatRef, turn: Turn): void {
  if (ref.generation !== talkGeneration()) return;
  updateTalk((t) => {
    const turns = turnsIn(t, ref.chat);
    if (!turns.some((x) => x.id === turn.id)) return t;
    return withChatTurns(
      t,
      ref.chat,
      turns.map((x) => (x.id === turn.id ? turn : x)),
    );
  });
}

const newest = <W extends MoveTurn["who"]>(turns: readonly Turn[], who: W) =>
  [...turns].reverse().find((turn): turn is Extract<MoveTurn, { who: W }> => turn.who === who);

/** The city the chat's newest move is to; undefined when the chat is not about a move, or the city has no guide. */
export const moveCity = (turns: readonly Turn[]): City | undefined => newest(turns, MoveSpeaker.moving)?.city;

/** The trades the chat's newest outlook was for. */
export const outlookTrades = (turns: readonly Turn[]): readonly Trade[] =>
  newest(turns, MoveSpeaker.outlook)?.trades ?? [];

/** The listing draft of the chat's newest question, when that question is still the newest turn. */
export function openDraft(turns: readonly Turn[]): ListingDraft | undefined {
  const last = turns.at(-1);
  return last?.who === MoveSpeaker.agent ? last.draft : undefined;
}

/** A mentor the chat showed, by id: an Ask acts only on someone the match returned. */
export function shownMentor(turns: readonly Turn[], user: UserId): MentorProfile | undefined {
  const lists = turns.filter((turn) => turn.who === MoveSpeaker.mentors);
  return lists.flatMap((turn) => turn.mentors).find((m) => m.user === user);
}
