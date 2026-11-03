# ADR 0048: A worker's own schedule, kept on the phone

Date: 2026-11-03. Status: accepted. Amended the same day: one time, one household (§5, §8). Builds on [ADR 0040](0040-on-phone-model-router.md) (chat text stays on the
phone), [ADR 0042](0042-meaning-router-small-embedding-model.md) (the meaning router),
[ADR 0033](0033-unpredictable-negotiation-model-tactics-and-terms.md) §3 (the `when` term) and
[ADR 0037](0037-server-held-record-earnings-and-moving-phones.md) (moving to a new phone).

## Context

A worker tested "save my booking for tomorrow 2-3PM" in Talk. The meaning router sent it to `find` (0.876 against
"I need a plumber today"-style sayings) and the reply was a line about the board. Even a right route had nowhere to
go: no intent keeps a booking, the best case was `remember` saving the words as a note, and nothing stores when a
worker is busy. Their agent therefore agrees to a job at a time they already gave to a customer they found outside
GigSync: `workerStance` only knows the jobs both sides signed in the app (`bookedTimes`).

Most of a worker's week is not GigSync work: regular houses, a contractor's site, a customer who rang directly. The
schedule is worth keeping only if it holds those.

## Decision

1. **Bookings live on the phone only**, in a `bookings` collection of the owner's storage, one record per booking
   (`Booking` in `packages/protocol/src/booking.ts`): a ULID id, the day (`YYYY-MM-DD`, or `daily` for work every
   day), start and end as minutes after local midnight, and an optional note in the owner's words (a place, a
   customer). A booking ends the same day; work past midnight is two bookings. Records are parsed with the schema
   whenever they are read, since a moved package or an older app may have written them.
   - **Why not the server:** who a worker sees and when is as private as what they type, and nothing on the server
     needs it. ADR 0040's line holds: chat text, and what code reads out of it, stays on the phone.
   - **Moving phones:** the collection is the owner's, so the QR move (ADR 0037, `transfer/`) carries it with
     everything else. It is not in `LEAVE_FIRST`: a full package drops chats and notes before it drops bookings. The
     merge treats a booking like any record: new ones are added, ones that differ wait for the owner's choice.
   - **Cost we accept:** a lost phone loses its bookings (no server copy), as it loses notes today. A worker signed in
     on two phones has two schedules; the phone that claims a request ([ADR 0045](0045-one-agent-per-job.md)) checks
     only its own. Syncing would mean sealing bookings to the owner's own devices through the mailbox, a later choice.
2. **One chat intent, `schedule`, for workers only.** The router names it; code decides what to do from the words,
   in this order: cancel words ("cancel", "हटा दो", "ರದ್ದು") remove; question words ("what", "क्या", "ಏನು") or no time
   list; a time saves. Three intents (save, list, cancel) were rejected: an embedding model places "save my booking
   tomorrow 2pm" and "cancel my booking tomorrow 2pm" side by side, and a wrong label would save a booking the worker
   asked to remove. A verb in a word list cannot be confused that way. The router carries no slots for it: the day,
   times and note are read by code from the owner's words, never by a model (models propose, code decides).
   - The embedding and model routers may name `schedule` only for words with a cue in them: a time, a booking or
     schedule word, or work on a day said (`hasScheduleCue`). Without one, the schedule's sayings do not compete, so
     "show my passbook" is not pulled toward "show my bookings".
   - The word lists hear it before notes, and never when a contact is named ("let Ravi see my schedule" is a rule).
     "Appointment" and "calendar" are not booking words: a doctor's appointment is a note.
3. **Times are read by code, in every language** (`schedule/clock.ts`, `schedule/read.ts`):
   - the day with the need interview's own reader (`dayIn`: today, tomorrow, the day after, every day, "5 Nov",
     "5/11"), else a day of the week ("Saturday", "शनिवार", "ಶನಿವಾರ", "shanivar"), the next one from today. The time
     is taken out of the sentence first, so "2-3" is never read as 2 March;
   - a range as two clock times joined by "-", "to", "se … (tak)", "से", "ರಿಂದ", "inda"; one time alone with a clock
     word ("2 pm", "2 बजे", "2 ಗಂಟೆಗೆ") is a booking of `DEFAULT_BOOKING_MINUTES` (an hour). A bare "5-11" is a date
     as often as a range, so a time said with am, pm or a clock word wins over it;
   - am or pm from the time itself, else from a part of the day ("दोपहर", "ಸಂಜೆ", "morning"), else the hour: 7 to 11
     is morning, 12 is noon, 1 to 6 is afternoon (work, not the small hours). A range ending in pm whose start would
     then come after its end starts in the morning ("11-1pm");
   - the note is the first clause left with words once the day, the time and the command words are taken out ("at
     Sharma ji's house", "वर्मा जी के घर सफाई");
   - with no day, today, or tomorrow when that time has already passed today.

   The reply repeats the day and times as code read them, so a wrong guess is seen at once and cancelled by chat.
4. **The schedule is bookings plus the GigSync jobs both sides signed**, read from the jobs, never copied: a copy
   would go stale when a job is cancelled. Talk's list shows both, a job by its day and part of the day (a job agrees
   only a window). Activity shows the bookings in their own card, with Delete on each; signed jobs keep their place in
   its "Agreed" group.
5. **The agent never agrees to a window a booking covers.** A booking's minutes map to the `when` term's windows
   (morning before noon, afternoon until 4 pm, evening after: the hours a household's "3 pm" is read against, now
   defined once in `schedule/windows.ts`), and `workerTerms` adds them to `bookedTimes`. A household asking for a
   booked window gets the worker's next free one, or no deal when none is free, exactly as for a signed job. Saving a
   booking that overlaps another booking or a signed job saves it and says so: the worker may well have double-booked
   on purpose, and only they can call a customer.
   - **One time, one household.** Testing this showed a worker double-booked on main: two households asked for the
     same morning, the agent offered it to both while nothing was signed, and signed back whichever household signed,
     both of them. Now the first to sign gets the time (`job/taken.ts`, `job/worker-time.ts`). A time is taken by a
     signed job, by a deal the worker signed that waits for the household, or by a booking. The worker's side never
     signs a taken time: when a household signs one, or the owner taps Sign on one, the agent re-offers the next free
     time at the price already reached (the protocol lets a new offer reopen a deal awaiting signatures), or ends the
     talks when none is free. After every sync and every Sign tap, any other deal waiting for the worker's signature
     at a now-taken time is re-offered, so with auto-sign off (the default) the owner never sees two deals for one
     morning.
6. **Availability grants stay unanswered for now.** `Topic.availability` is a schema with no flow behind it. When it
   gets one, it answers "busy" or "free" for a part of a day from this schedule and never a note, a customer or a
   place. Nothing here depends on it.
7. **Reminders are the phone's own, while the app runs.** A booking within `REMINDER_LEAD_MINUTES` (30) of its start
   is marked "Starts in … min" on Activity and, when the owner allowed notifications (ADR 0044), as a notification from the
   service worker, once per booking and day. A reminder timed by the server was rejected: the server would have to
   know when a worker is busy. A closed app gets no reminder; that needs the phone's own scheduled notifications
   (Capacitor Local Notifications in the native apps), a new dependency for a later change.
8. **One phone at a time.** A worker's phone handles one message and one tap at a time (`useGig`'s queue), so the
   check in §5 cannot race itself. Two phones of one worker can still each give away the same time: each answers the
   requests it claimed ([ADR 0045](0045-one-agent-per-job.md)) and does not see the other's deals. That needs a lock
   both phones share, such as an opaque slot claim in the owner's own mailbox; it is designed in its own ADR, together
   with clock-time slots for hourly work.

## Consequences

- Measured on the eval set (`pnpm eval:intent --keywords-only`, embedding model `multilingual-e5-small`): the 36 new
  `wide-schedule` cases route right 32 times through the app's chain (word lists alone 32, embedding alone 31), and
  none of the 1,452 earlier cases changes its answer. The eval script never warmed the embedding index since it
  became lazy (#23), so its "meaning" column read 0%; it now warms it first. The model router was not re-measured
  (no Ollama run), so `docs/gigsync/intent-eval.md` is not regenerated here.

- The router has one more intent to tell apart. Its sayings (`EXAMPLES`, `MORE_SAYINGS` and the Hinglish and
  Kanglish lists) gain booking phrasings, and the eval gains a `wide-schedule` file per set. The word lists hear a
  booking before a note, so "save my booking …" is no longer kept as a note, while "save: Kabir pays on the 5th"
  still is.
- A reminder needs the app open or in the background; on iPhone that means added to the Home Screen as well.
- Old phones in a job do not change: the check runs on the worker's own phone, inside `workerTerms`, and a job
  without terms (an older household phone) still agrees no window, so a booking cannot stop it. The worker sees the
  day in the request and decides.
- Recurring work other than every day ("every Monday") is not understood; it is saved as one day.
