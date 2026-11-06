# ADR 0055: A household recommends a worker through its own contacts, with the worker's QR link

Date: 2026-11-06. Status: accepted. Amends [ADR 0031](0031-no-colleagues-mentor-links-only.md) §3 and its consequence
that a household can introduce two workers. Extends [ADR 0034](0034-personal-qr-to-find-someone.md).

## Context

"Introduce {name} to someone" on a household's finished job card did not do what its name suggests. The household
picked another worker it knew, each worker got an `introduce` saying the other was moving to, or worked in, Bengaluru (a
city fixed in the code, which the household never gave), and two yeses opened a 30-day mentor link between the workers.
No household was ever reached.

The founders want the opposite: a household that trusts a worker connects them to another household it knows. Three
facts decide how:
- **A household knows no other household on GigSync.** ADR 0031 §3 counts a signed job or a mentor link. A household's
  jobs are with workers and it has no mentor links, so a picker of "people connected on GigSync" would be empty, and a
  second household's phone would drop an `introduce` from someone it does not know.
- **A contacts permission would cost more than it gives.** It needs a native plugin, does not exist on the web app, and
  showing which contacts are on GigSync means sending hashes of numbers belonging to people who never agreed to it.
- **The worker's QR link already does the rest** (ADR 0034). It shows the card, never a number. "Ask {name} for work"
  starts the usual request, the worker can decline it, and contact details go only after both sign. Making a new QR ends
  every link that went before.

## Decision

1. **The phone's share sheet is the picker.** A household taps "Recommend {name}" on a job card, then Share, Send on
   WhatsApp, or Copy link. It picks a contact or a group in the app it already uses. GigSync asks for no contacts
   permission, adds no plugin, and never learns whom the household picked or whether that person is on GigSync. Someone
   on GigSync and someone not on it receive the same link; the second signs up first and the link is kept through
   sign-in (ADR 0034 §4).
2. **What travels is the worker's live QR link and a short line in the sender's voice.** The friend sees who it came
   from in their own chat, so GigSync adds no "recommended by" to the card. A household's message is the household's
   own: nothing here passes through a GigSync account on WhatsApp, and ADR 0021 stands.
3. **Who may be recommended.** The phone offers it on a job both sides signed, for the household that hired, once the
   work is finished or while recurring work is under way. Not on a cancelled job.
4. **The server hands out the code.** `POST /v1/qr/recommend` returns the worker's live code only when the caller is the
   household on a job record with them that was not cancelled, the worker has not blocked the caller, and the worker has
   a card on the board. A worker who has never opened My card gets their code made here, with the first name on their
   card. No new table: the lookups cap applies.
5. **The worker is told, not asked.** The first time a household shares from a job, its phone sends `recommended` on that
   job, and the worker's Activity says so until they tap OK. The card was already public, the receiving household decides
   whether to ask, and the worker can still decline the request, so a yes in advance would ask them to approve nothing
   they do not already control. The stop is theirs: taking the card off the board, or making a new QR.
6. **Protocol.** `recommended` is a side-channel kind with an empty body, sent only when every phone of the worker reports
   `RECOMMEND_PROTOCOL` (11). On an older phone the share still works and the worker is not told; the household is told
   only that the link was shared.
7. **The old button goes.** Job cards no longer offer a household the worker-to-worker introduction, and a newcomer no
   longer asks a household on a job whether they know someone in a city, since a household could no longer act on it.
   Workers keep introductions and asking around on mentor links, and `introduce` envelopes from older phones are still
   received.

## Consequences

- Reach depends on the household's own contacts, which is what "someone you know" means, but GigSync cannot show who is
  already on it, and cannot say on the card who recommended a worker.
- A job with no record on the server (both sides declined the record notice, or a job from before ADR 0038) cannot be
  recommended; the phone says so.
- Sharing a live code means a worker's new QR ends links other people sent, which is what the worker wants when they
  replace one.
- A recommended household arrives as a usual request, so nothing counts recommendations, and no revenue or ranking rests
  on them.
- Household-to-household links stay out. If they are wanted later they would bring back in-person pairing, which ADR
  0031 removed for colleagues.
