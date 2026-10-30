import { type Chat, deleteChat, type InterviewState, log, Slot, type Storage, saveChat } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { interviewConfig } from "../card/choices.js";
import type { LiveInterview, Talk } from "./talkStore.js";
import { isTurn, type Turn } from "./turns.js";

/**
 * Talk's chats on the phone, under their owner (ADR 0032, ADR 0035): each chat is one record, rewritten when a turn
 * is added or changed. The unfinished card interview is kept in the record of the chat it started in, with its draft,
 * so it can be carried on after a restart or the next sign-in. Its draft holds the lowest rate, as typed, and the
 * lines that read it back stay silent; like the rest of the owner's records, none of it leaves the phone.
 */

/** An interview's state as kept: without its settings, which are the app's own and rebuilt from the language. */
type KeptState = Omit<InterviewState, "config">;

/** The unfinished card interview, as kept in its chat's record. */
interface HeldInterview {
  own: Lang;
  state: KeptState;
  /** The state at confirm, kept while the owner's yes is being published. */
  before?: KeptState | undefined;
  paused: boolean;
}

/** A Talk chat as kept on the phone: its turns, and the card interview when it is this chat's. */
interface KeptChat extends Chat<Turn> {
  interview?: HeldInterview | undefined;
}

const SLOTS: ReadonlySet<string> = new Set(Object.values(Slot));
const LANGS: ReadonlySet<string> = new Set(Lang.options);

const strip = ({ config: _config, ...kept }: InterviewState): KeptState => kept;

const hold = (live: LiveInterview): HeldInterview => ({
  own: live.state.config.own,
  state: strip(live.state),
  before: live.beforeDone && strip(live.beforeDone),
  paused: live.paused,
});

const isKeptState = (value: unknown): value is KeptState =>
  typeof value === "object" &&
  value !== null &&
  "slot" in value &&
  typeof value.slot === "string" &&
  SLOTS.has(value.slot) &&
  "draft" in value &&
  typeof value.draft === "object" &&
  value.draft !== null;

function isHeld(value: unknown): value is HeldInterview {
  if (typeof value !== "object" || value === null) return false;
  if (!("own" in value && "state" in value && "paused" in value)) return false;
  const before = "before" in value ? value.before : undefined;
  return (
    typeof value.own === "string" &&
    LANGS.has(value.own) &&
    typeof value.paused === "boolean" &&
    isKeptState(value.state) &&
    (before === undefined || isKeptState(before))
  );
}

/** A chat read back from the phone: its turns of the shape this app writes, and its card interview, if it holds one. */
export function readChat(record: Chat<unknown>): {
  chat: Chat<Turn>;
  interview?: Pick<LiveInterview, "state" | "paused"> | undefined;
} {
  const held = "interview" in record ? record.interview : undefined;
  const { v, id, title, started_at, updated_at } = record;
  const chat: Chat<Turn> = { v, id, title, started_at, updated_at, turns: record.turns.filter(isTurn) };
  if (!isHeld(held)) return { chat };
  // Said yes and closed before the card was on the board: back at confirm, so a yes sends it.
  const kept = held.state.slot === Slot.done ? held.before : held.state;
  if (!kept) return { chat };
  return { chat, interview: { state: { ...kept, config: interviewConfig(held.own) }, paused: held.paused } };
}

/** Writes run one after another, so a chat's records land in the order its turns changed. */
let writes: Promise<void> = Promise.resolve();
function queue(job: () => Promise<void>): void {
  writes = writes
    .then(job)
    .catch((err: unknown) =>
      log.warn("talk chat not kept", { error: err instanceof Error ? err.message : String(err) }),
    );
}

const heldIn = (talk: Talk, chat: string) => (talk.live?.chat === chat ? talk.live : undefined);

/** Keeps on `storage` (the owner's) what changed between two states of Talk: chats changed, emptied or gone. */
export function keepChanges(storage: Storage, prev: Talk, next: Talk): void {
  const before = new Map(prev.chats.map((c) => [c.id, c]));
  for (const chat of next.chats) {
    const live = heldIn(next, chat.id);
    if (before.get(chat.id) === chat && heldIn(prev, chat.id) === live) continue;
    if (chat.turns.length > 0) {
      const record: KeptChat = { ...chat, interview: live && hold(live) };
      queue(() => saveChat(storage, record));
    } else if (before.has(chat.id)) queue(() => deleteChat(storage, chat.id));
  }
  const kept = new Set(next.chats.map((c) => c.id));
  for (const id of before.keys()) if (!kept.has(id)) queue(() => deleteChat(storage, id));
}
