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
   first. Opening one shows it and lets the owner carry on; Delete asks once, then removes it from the phone. Every
   launch and reload opens a new chat, with the past ones in the list (amended 2026-11-13: the newest used to reopen).
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

## Households (amendment, 2026-10-30)

A household's chat is Find's, and it was not kept: New chat wiped it, and so did a restart. Households asked for the
same history workers have. Find's chats now follow the decisions above, with these differences:
1. **Their own collection.** Find's chats are kept in `Collection.findChat` through the same core store
   (`ChatShelf.find`), so Talk never reads a Find turn as its own, nor the other way round. Titles, the 30-chat and
   100-turn caps, the day groups and Delete's one confirm are the core's, shared with Talk.
2. **One chat, one need.** Each chat holds at most one need. It is history once the household has said something in
   it; the opening question alone is not, so an untouched chat is neither kept nor listed.
3. **An unsent need carries on.** Until the workers are asked, the need (its draft, the budget as typed, and what the
   agent remembered when it began) is kept in its chat's record. Opening the chat, now or after a restart or the next
   sign-in, shows the question it stood at; one closed after the yes but before the search answered searches again.
   The menu marks such a chat "Not sent to workers yet". After loading, a new chat opens, ready for the next need
   (amended 2026-11-13: an unsent need used to open by itself; owners wanted every launch and reload to start afresh, so
   it now waits in the list).
4. **A sent need stays to read, not to reuse.** Once the workers are asked, the chat keeps what was said, the workers
   found (their boxes fixed) and the "Asked" line, and its job lives on in My jobs as before. Find moves on to a new
   chat at that moment, so coming back to it starts the next need, as it always did. Reopening the sent chat from the
   menu shows what was said, with "Ask for something else" in place of the composer: it opens a new chat, as New chat
   does, and the sent chat stays as it was. A second need is never added to a sent chat, so each chat's title names
   the one request it made.
5. **Deleting** a sent chat says its job stays in My jobs: only the conversation leaves the phone, never the job, the
   offers or the private budget kept with the request (`Collection.needs`).

## Households ask only in the chat (amendment, 2026-10-30)

Find also had a form ("Use the form instead"), and a worker chosen from their QR or their offer to work was asked
through it. Owners asked for one way to ask, so the form is gone and the chat is how a household asks:
1. **No form.** Find shows its chat alone. The form's screen, its scope chips and its strings are removed.
2. **A chat addressed to one worker.** "Ask {name} for work" on a worker's QR, and Ask on their offer in My jobs, open a
   new Find chat addressed to them (the open chat stays in the list, or goes if nothing was said in it). The need
   carries the worker (`NeedState.to`: their id, name and trades), and the interview asks only what that worker needs:
   the need in the household's words, said to the worker by name; the trade only when their card has several, and only
   among those; the details, the area (unless the agent remembers it), when, and the budget with the estimate beside it.
   The readback asks "Shall I ask {name}?", and the yes sends the need to that worker alone. There is no search and no
   list to pick from. If sending fails, the readback comes back, so another yes tries again.
3. **What the chat cannot hear.** A time is kept as the household says it only where the chat reads a time (a part of
   the day, a clock time, "8am", "ಬೆಳಗ್ಗೆ 7 ಗಂಟೆ"). Free text the form took, such as "Mon–Sat 7–10", is not read
   yet. The household can say it again in other words at the readback.

## Consequences

- The interview's draft, the lowest rate included, now rests on the phone between sessions, like the UPI ID and a
  household's budget: separated by owner, not encrypted (ADR 0032).
- Each change to a chat rewrites its record (at most 100 turns), one write after another so they land in order.
- No sync or backup: a lost phone loses its chats.
- A household's unsent budget now rests on the phone between sessions too, in its chat's record, as the card draft's
  lowest rate does: separated by owner, not encrypted.
