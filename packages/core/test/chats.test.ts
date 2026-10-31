import { describe, expect, it } from "vitest";
import {
  CHAT_TITLE_CHARS,
  type Chat,
  ChatDay,
  ChatShelf,
  Collection,
  chatTitle,
  deleteChat,
  groupChats,
  isChat,
  loadChats,
  MAX_CHAT_TURNS,
  MAX_CHATS,
  newChat,
  OwnerStorage,
  pruneChats,
  saveChat,
  withTurns,
} from "../src/index.js";
import { phoneOwners } from "./owners.js";

/** A turn as a test app would keep it: the owner's words, or the agent's. */
type Turn = { by: "owner" | "agent"; text: string };
const OWNER = "owner";
const words = (turn: Turn) => (turn.by === OWNER ? turn.text : undefined);
const owner = (text: string): Turn => ({ by: OWNER, text });
const agent = (text: string): Turn => ({ by: "agent", text });

/** 30 October 2026, 10:00 in India (UTC+5:30). */
const NOW = new Date("2026-10-30T10:00:00+05:30");
const INDIA = 330;
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

/** A chat with one owner turn, last changed at `when`. */
const chatAt = (when: Date, text = "hello"): Chat<Turn> => withTurns(newChat<Turn>(when), [owner(text)], when, words);

describe("a chat's title", () => {
  it("is the owner's first words, on one line", () => {
    const chat = withTurns(newChat<Turn>(NOW), [agent("What work?"), owner("  I   cook\nfood ")], NOW, words);
    expect(chat.title).toBe("I cook food");
  });

  it("is none while only the agent has spoken, and blank words do not count", () => {
    expect(withTurns(newChat<Turn>(NOW), [agent("What work?"), owner("   ")], NOW, words).title).toBeUndefined();
    expect(chatTitle(" \n ")).toBeUndefined();
  });

  it("is cut with an ellipsis, never through a Hindi syllable", () => {
    const long = "मेरा रेट बदलो ".repeat(10);
    const title = chatTitle(long) ?? "";
    expect(title.endsWith("…")).toBe(true);
    const letters = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(title)];
    expect(letters.length).toBeLessThanOrEqual(CHAT_TITLE_CHARS + 1);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
    expect(chatTitle("short")).toBe("short");
  });

  it("stays once given, even after its turn is dropped as old", () => {
    const first = withTurns(newChat<Turn>(NOW), [owner("first words")], NOW, words);
    const later = withTurns(first, [owner("other words")], NOW, words);
    expect(later.title).toBe("first words");
  });
});

describe("a chat's turns", () => {
  it("keeps the newest past the cap, and when it last changed", () => {
    const turns = Array.from({ length: MAX_CHAT_TURNS + 5 }, (_, i) => owner(`turn ${i}`));
    const chat = withTurns(newChat<Turn>(ago(2)), turns, NOW, words);
    expect(chat.turns).toHaveLength(MAX_CHAT_TURNS);
    expect(chat.turns[0]).toEqual(owner("turn 5"));
    expect(chat.title).toBe("turn 0");
    expect(chat.updated_at).toBe(NOW.toISOString());
    expect(chat.started_at).toBe(ago(2).toISOString());
  });
});

describe("the chat list", () => {
  it("groups by the owner's day, Today, Yesterday and Earlier, newest first", () => {
    const [a, b] = [chatAt(ago(1), "a"), chatAt(ago(9), "b")];
    // 23:00 the day before in India, though it is still the same UTC day as NOW.
    const yesterday = chatAt(new Date("2026-10-29T23:00:00+05:30"), "c");
    const earlier = chatAt(ago(72), "d");
    const groups = groupChats([earlier, b, yesterday, a], NOW, INDIA);
    expect(groups.map((g) => g.day)).toEqual([ChatDay.today, ChatDay.yesterday, ChatDay.earlier]);
    expect(groups[0]?.chats.map((c) => c.title)).toEqual(["a", "b"]);
    expect(groups[1]?.chats.map((c) => c.title)).toEqual(["c"]);
    expect(groups[2]?.chats.map((c) => c.title)).toEqual(["d"]);
  });

  it("leaves out empty headings and a chat with nothing said in it", () => {
    const groups = groupChats([newChat<Turn>(NOW), chatAt(ago(72))], NOW, INDIA);
    expect(groups.map((g) => g.day)).toEqual([ChatDay.earlier]);
    expect(groupChats([], NOW, INDIA)).toEqual([]);
  });

  it("drops the oldest past the cap, but never a chat it is told to keep", () => {
    const chats = Array.from({ length: MAX_CHATS + 2 }, (_, i) => chatAt(ago(i + 1), `chat ${i}`));
    const oldest = chats.at(-1);
    if (!oldest) throw new Error("no chats");
    const { kept, dropped } = pruneChats(chats, new Set([oldest.id]));
    expect(kept).toHaveLength(MAX_CHATS);
    expect(kept.map((c) => c.id)).toContain(oldest.id);
    expect(dropped).toEqual([chats[MAX_CHATS - 1]?.id, chats[MAX_CHATS]?.id]);
    expect(pruneChats(chats.slice(0, 3), new Set()).dropped).toEqual([]);
  });
});

describe("chats on the phone", () => {
  it("are kept per owner: saved, read back newest first, and deleted", async () => {
    const { phone, sita, geeta } = phoneOwners();
    const [mine, theirs] = [new OwnerStorage(phone, sita), new OwnerStorage(phone, geeta)];
    const [older, newer] = [chatAt(ago(5), "older"), chatAt(ago(1), "newer")];
    await saveChat(mine, ChatShelf.talk, older);
    await saveChat(mine, ChatShelf.talk, newer);
    expect((await loadChats(mine, ChatShelf.talk)).map((c) => c.id)).toEqual([newer.id, older.id]);
    // Another owner signing in on the same phone sees none of them.
    expect(await loadChats(theirs, ChatShelf.talk)).toEqual([]);
    await deleteChat(mine, ChatShelf.talk, older.id);
    expect((await loadChats(mine, ChatShelf.talk)).map((c) => c.id)).toEqual([newer.id]);
  });

  it("keeps a household's Find chats apart from Talk's", async () => {
    const { phone, sita } = phoneOwners();
    const mine = new OwnerStorage(phone, sita);
    const [talk, find] = [chatAt(ago(2), "talk"), chatAt(ago(1), "find")];
    await saveChat(mine, ChatShelf.talk, talk);
    await saveChat(mine, ChatShelf.find, find);
    expect((await loadChats(mine, ChatShelf.talk)).map((c) => c.id)).toEqual([talk.id]);
    expect((await loadChats(mine, ChatShelf.find)).map((c) => c.id)).toEqual([find.id]);
    await deleteChat(mine, ChatShelf.find, find.id);
    expect(await loadChats(mine, ChatShelf.find)).toEqual([]);
    expect(await loadChats(mine, ChatShelf.talk)).toHaveLength(1);
  });

  it("skips records without a chat's shape, and removes the old agent log", async () => {
    const { phone, sita } = phoneOwners();
    const mine = new OwnerStorage(phone, sita);
    const kept = chatAt(ago(1));
    await saveChat(mine, ChatShelf.talk, kept);
    await mine.put(Collection.chat, "ch_1730000000000", { text: "a note", at: NOW.toISOString() });
    await mine.put(Collection.chat, "chat_future", { ...kept, id: "chat_future", v: 2 });
    expect((await loadChats(mine, ChatShelf.talk)).map((c) => c.id)).toEqual([kept.id]);
    expect(await mine.ids(Collection.chat)).not.toContain("ch_1730000000000");
    // A record from a newer app is left alone, for that app to read.
    expect(await mine.ids(Collection.chat)).toContain("chat_future");
  });

  it("checks a record's shape before it is read as a chat", () => {
    expect(isChat(chatAt(NOW))).toBe(true);
    expect(isChat(null)).toBe(false);
    expect(isChat({ ...chatAt(NOW), turns: "x" })).toBe(false);
    expect(isChat({ ...chatAt(NOW), updated_at: "yesterday" })).toBe(false);
    expect(isChat({ ...chatAt(NOW), id: "ch_1" })).toBe(false);
    expect(isChat({ ...chatAt(NOW), title: 7 })).toBe(false);
  });
});
