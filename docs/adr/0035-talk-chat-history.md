# ADR 0035: Talk keeps a history of chats on the phone; the card interview lives in the chat it started in

Date: 2026-10-30. Status: accepted. Builds on [ADR 0032](0032-data-kept-per-owner.md).

## Context

Talk was one conversation held in memory. "New conversation" cleared it after a confirm, so the previous history was
gone, and an app restart lost it too. Owners asked for what the collab app had: start a new chat, go back through
past chats, delete one.

## Decision

1. **A chat is a list of turns of any kind.** The core (`packages/core/src/chat`) knows a chat's id, title, start and
   last change, and its turns, and nothing of what a turn holds; the app says which words in a turn are the owner's.
   Later features (moving to a new city through chat) add turn kinds without changing the model.
2. **Kept per owner, on the phone.** One record per chat in `Collection.chat`, under the owner (ADR 0032): it survives
   a restart and signing out and in; another owner on the phone sees none of it. Nothing leaves the phone.
3. **Limits.** The newest 30 chats are kept (`MAX_CHATS`), each with its newest 100 turns (`MAX_CHAT_TURNS`). The open
   chat and the one holding the card interview are never dropped. An empty chat is not kept or listed.
4. **Titles and the list.** A chat is titled from the owner's first words in it, cut to 48 letters (never through a
   Hindi or Kannada syllable). Chats lists them under Today, Yesterday and Earlier by the owner's calendar, newest
   first. Opening one shows it and lets the owner carry on; Delete asks once, then removes it from the phone.
5. **New chat** keeps the open chat in the list and opens an empty one, which shows the usual suggestions. The
   "New conversation" button and its confirm are gone.
6. **The card interview.** At most one is live, and it belongs to the chat it started in. Leaving that chat (New chat,
   or opening another) pauses it there; the list marks that chat, and opening it offers "Carry on". Opening Talk to make
   or change the card goes to that chat. Starting another interview elsewhere replaces it (its chat keeps what was
   said). Deleting its chat ends it. Its state is kept in its chat's record with the draft, so it carries on after a
   restart; one closed after the owner's yes but before the card was on the board comes back at confirm.
7. **Private amounts** are kept as typed, as before; the lines that read the lowest rate back stay silent.
8. **The agent's old log goes.** The agent used to log every answered note in `Collection.chat`, read by nothing; those
   copies would have outlived a deleted chat. It no longer writes them, and the old records are removed when chats
   first load.

## Consequences

- The interview's draft, the lowest rate included, now rests on the phone between sessions, like the UPI ID and a
  household's budget: separated by owner, not encrypted (ADR 0032).
- Each change to a chat rewrites its record (at most 100 turns), one write after another so they land in order.
- No sync or backup: a lost phone loses its chats.
