import { ulid } from "ulid";

/**
 * Talk's chats, as the collab app kept its sessions: every conversation with the agent is one chat, kept on the phone
 * under its owner (ADR 0032, ADR 0035) until the owner deletes it. A chat is a list of turns of any kind; the app
 * decides what a turn holds (a note and its answer, a card interview's question, a move) and tells the core only which
 * words in a turn are the owner's own, for the chat's title.
 */

/** The version of a kept chat's shape; a record of another version is not read back. */
export const CHAT_FORMAT = 1;
/** The newest this many chats are kept; older ones are dropped first. */
export const MAX_CHATS = 30;
/** A chat keeps this many turns; older ones are dropped first. */
export const MAX_CHAT_TURNS = 100;
/** A chat's title is its owner's first words, cut to this many characters (letters as a reader sees them). */
export const CHAT_TITLE_CHARS = 48;
/** What a cut title ends with. */
const ELLIPSIS = "…";
/** Every chat id starts with this, so a bare id says what it names. */
const CHAT_PREFIX = "chat_";
const SPACES = /\s+/g;

export interface Chat<T> {
  v: typeof CHAT_FORMAT;
  id: string;
  /** The owner's first words in it, cut short; none until they say something. */
  title?: string | undefined;
  /** ISO times: when the chat was started, and when a turn was last added or changed. */
  started_at: string;
  updated_at: string;
  turns: readonly T[];
}

/** The owner's own words in a turn, if it holds any. */
export type WordsOf<T> = (turn: T) => string | undefined;

const chatId = (now: Date): string => `${CHAT_PREFIX}${ulid(now.getTime())}`;

/** An empty chat: shown with the ways into Talk, and kept only once something is said in it. */
export function newChat<T>(now: Date): Chat<T> {
  const at = now.toISOString();
  return { v: CHAT_FORMAT, id: chatId(now), started_at: at, updated_at: at, turns: [] };
}

/** One "letter" as a reader sees it: a Hindi or Kannada syllable with its vowel signs is never cut in two. */
const graphemes = (text: string): string[] =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);

/** A title from the owner's words: on one line, cut to `CHAT_TITLE_CHARS` with an ellipsis; undefined when blank. */
export function chatTitle(words: string): string | undefined {
  const line = words.replace(SPACES, " ").trim();
  if (!line) return undefined;
  const letters = graphemes(line);
  if (letters.length <= CHAT_TITLE_CHARS) return line;
  return `${letters.slice(0, CHAT_TITLE_CHARS).join("").trimEnd()}${ELLIPSIS}`;
}

/**
 * The chat with its turns now `turns`, changed at `now`: the oldest dropped past `MAX_CHAT_TURNS`, and titled from the
 * owner's first words in it if it had no title yet. A title once given stays, even when its turn is dropped as old.
 */
export function withTurns<T>(chat: Chat<T>, turns: readonly T[], now: Date, wordsOf: WordsOf<T>): Chat<T> {
  const kept = turns.length > MAX_CHAT_TURNS ? turns.slice(-MAX_CHAT_TURNS) : turns;
  const title = chat.title ?? firstTitle(turns, wordsOf);
  return { ...chat, title, turns: kept, updated_at: now.toISOString() };
}

function firstTitle<T>(turns: readonly T[], wordsOf: WordsOf<T>): string | undefined {
  for (const turn of turns) {
    const title = chatTitle(wordsOf(turn) ?? "");
    if (title) return title;
  }
  return undefined;
}

const isIso = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

/**
 * A record read from the phone's storage that has a chat's shape in this version: its turns are still the app's to
 * check one by one.
 */
export function isChat(value: unknown): value is Chat<unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (!("v" in value && "id" in value && "started_at" in value && "updated_at" in value && "turns" in value))
    return false;
  const title = "title" in value ? value.title : undefined;
  return (
    value.v === CHAT_FORMAT &&
    typeof value.id === "string" &&
    value.id.startsWith(CHAT_PREFIX) &&
    (title === undefined || typeof title === "string") &&
    isIso(value.started_at) &&
    isIso(value.updated_at) &&
    Array.isArray(value.turns)
  );
}
