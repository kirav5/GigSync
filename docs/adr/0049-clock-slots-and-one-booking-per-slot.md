# ADR 0049: Clock times for hours-based work, and one booking per slot across a worker's phones

Date: 2026-11-03. Status: proposed. Amends [ADR 0033](0033-unpredictable-negotiation-model-tactics-and-terms.md) §3
(the `when` term), [ADR 0045](0045-one-agent-per-job.md) (the owner's mailbox also arbitrates time),
[ADR 0046](0046-work-arrangements-hourly-to-monthly.md) §6 (the terms gate) and
[ADR 0048](0048-worker-schedule-on-the-phone.md) §1 and §5 (bookings checked by the minute, and from the other phone).

## Context

The `when` term (`TermWhen`, `packages/protocol/src/terms.ts`) is a day, or `daily`, plus `morning`, `afternoon` or
`evening`. Two times clash only when their windows are equal (`clashes`, `packages/core/src/job/terms.ts`). That was
enough for an electrician's visit. It is not enough for the work ADR 0046 opened up:
- A household's "3 pm" becomes `afternoon` (`windowOf`, `interview/need-terms.ts`), and its "3 hours" travels as the
  separate `hours` term, never joined to the start. A 9–11 house and an 11:30–1 house are both `morning`, so the
  agent refuses the second though they do not overlap; an 11–1 house and a 12:30 start are `morning` and
  `afternoon`, so it agrees to both though they do.
- A booking saved as 2–3 pm (ADR 0048 §5) blocks the whole afternoon window, so a 4:30 request is refused.
- Weekly work has no named days. `need-arrangement.ts` sets every weekly and monthly need to `daily`, so a worker who
  takes a Monday-Wednesday-Friday job is busy every day of the week in that window.
- The offer's `slot` field (`Offer.slot`, `JobTerms.slot`) is free text that nothing reads.

Separately, a two-household test double-booked a worker on one phone: both asked for the same morning and the agent
signed both, because nothing rechecks `when` at signing on the worker side. That recheck is being added in its own
change. It cannot cover a worker with two phones: under ADR 0045 each phone may win the claim on a different request,
the phone that lost a claim follows only cancels, and neither knows what the other agreed or what bookings the other
holds. Two phones can each sign the same slot, with no shared state to stop them.

Facts this decision rests on:
- The server already learns the day and window of every signed job: the job record (ADR 0038) carries `terms.when`,
  stored as `work_day` and `work_window` (`workers/api/src/records/fields.ts`). It never learns a clock time or a
  booking. This ADR must not change that.
- The owner's `Mailbox` Durable Object handles one call at a time and already holds the engagement claims of ADR 0045
  in its own SQLite storage. Durable Object storage is not Neon.
- A worker's phones share no secret. Each has its own signing and encryption keys; the directory lists them.

## Decision, part 1: clock slots

1. **`TermWhen` gains an optional slot**: `start_min` and `end_min`, minutes after local midnight as in `Booking`
   (`packages/protocol/src/booking.ts`), and `days`, the ISO weekdays (1 = Monday … 7 = Sunday) of work that recurs
   on some days. All three are optional; a `when` without them means what it means today.
   - Both times or neither; `end_min > start_min`; both multiples of `SLOT_STEP_MIN` (15), the step a household
     speaks in ("sawa teen", "saadhe teen"); a slot ends on the day it starts, like a booking.
   - `window` stays required and must be the window `start_min` falls in, so every phone and the server's record
     keep a window to file and show the job by.
   - `days` only with `day: daily`, at least one and each at most once.
2. **Which jobs carry a slot:** jobs of trades that negotiate `hours` (maid, cook, driver: `TRADE_TERMS`), in every
   arrangement. The length is known for them (the `hours` term, or the visit's hours). Electricians, plumbers and the
   other one-visit trades keep windows: nobody knows ahead how long a repair takes, and households book them by
   arrival window. When a slot and `hours` are both set they must agree (`end_min - start_min = hours × 60`); a
   counter on `hours` moves `end_min` with it.
3. **The gate.** A new key inside `when` changes the terms hash: a phone at `TERMS_PROTOCOL` (5) parses `when`,
   strips the keys it does not know and hashes different terms, so the deal can never be signed. So:
   - `SLOTS_PROTOCOL = 6` in `terms.ts`, including 5 and everything before it. A slot is proposed only when every
     device of the other side speaks it (`ctx.speaks`, as `speaksTerms` does).
   - The job decides once, when this side first plans it, as `termsOn` does for terms: `TermsTrack` gains
     `slots: boolean`, absent (false) on every job saved before. `termsField` strips `start_min`, `end_min` and
     `days` from every offer on a job without slots, so a slot never reaches a phone that would hash it differently.
   - One bump for all three keys, so weekly days do not need a second bump later even if their interview comes later.
   - **The job record keeps day and window only.** `JobTermsFields` pins `when` to `{ day, window }` instead of
     spreading `TermWhen.shape`, and phones drop the slot before `POST /v1/jobs/records`. The server's record never
     needed a clock time (market prices are by area and arrangement), the server checks the sender's signature over
     its own hash rather than recomputing it, and the Neon schema stays as it is. A job restored from the record on a
     new phone has its window, not its minutes.
4. **The household's words become a slot**, by code in `need-terms.ts` (`slotOf`, beside `windowOf`), never by a
   model:
   - a clock time said with am, pm or a clock word, read by ADR 0048's clock reader (`schedule/clock.ts`), so "3
     pm", "3 बजे", "ಮಧ್ಯಾಹ್ನ 3 ಗಂಟೆಗೆ" and "11-1" mean the same in Find as in Talk; a range sets both ends;
   - one time alone takes its length from `hours`. When the household gave no hours, Find asks "For how many hours?"
     (chips 1 to 4, and "Not sure"). "Not sure", or only a part of the day ("morning"), sets the window alone, as
     today: nothing is guessed (the rule in `need-terms.ts`);
   - the readback and the sign screen say the slot in the owner's language ("3 pm to 5 pm", "दोपहर 3 से 5 बजे तक");
   - a household that said it is flexible about time (`flexible`) accepts a start up to `NEAR_MINUTES` (60) either
     way on the same day, or the same slot the next day, in place of today's "same day or the next" for windows.
5. **The worker's card becomes a stance in minutes**, on the phone only (`TermPrefs` is never on the board):
   - the preferred windows become minutes, clipped to a working day of `WORK_DAY_FROM_MIN` (6:00) to
     `WORK_DAY_TO_MIN` (22:00): a "morning" worker accepts a slot that lies wholly between 6:00 and noon;
   - `TermPrefs.buffer_min`, the gap the worker needs between two jobs to get from one to the next, asked on the card
     only of workers who take hours-based work (chips "No gap", "30 min", "1 hour"); `DEFAULT_BUFFER_MIN` (30) when
     unset;
   - with a day and preferred windows, the agent proposes the first free start in them, as it proposes the first
     free window today.
6. **Overlap is by minutes, with the buffer.** A time covers `[start, end + buffer)` on its days; two times clash when
   those stretches overlap on a day both are on. A `when` without a slot covers its whole window, and a booking its
   own minutes, so a 2–3 pm booking no longer blocks a 4:30 pm slot but still blocks an old-style "afternoon" job.
   Days: a date is on itself; `daily` without `days` is on every date; `daily` with `days` is on those weekdays.
   Counter-proposals keep the asked length and move the start in steps of `COUNTER_STEP_MIN` (30) within the day,
   then the same starts on the next `DAYS_AHEAD` days, closest first, as `candidates` does for windows. `sameTerm`
   compares the slot and the days too, so a moved start is a changed term the household signs itself (`mustReview`).
7. **Weekly and monthly.**
   - **Weekly** names its days. After "how many days", Find asks "Which days?" (weekday chips, the names ADR 0048's
     reader already knows), and the `when` is `daily` with those `days`. The agents counter the time only, never the
     days: three days out of seven make 35 sets, too many to choose among by code, and households pick days for their
     own reasons. A worker busy on one of the days is `stuck` on `when` and their owner decides. A weekly job whose
     household did not name days stays `daily`, busy every day, as today: a free day shown as busy costs the worker
     a request; a busy day shown as free costs a household a morning.
   - **Monthly** is daily work (a cook, a maid's every morning) and may carry a slot like any other: `daily` with a
     start and end. Most of a maid's week is these, so this is where minute overlap matters most.
   - Work past midnight is not covered (a night driver): it keeps windows.

## Decision, part 2: one booking per slot across a worker's phones

8. **The worker's phone claims the slot in its owner's mailbox before it signs.** In `sign` (`job/deal.ts`), on the
   worker's side and only for a job with a `when`, the phone claims the cells the time covers in the owner's own
   `Mailbox` Durable Object, which takes one call at a time, so two phones claiming at once cannot both win. The
   claim is the same pattern as ADR 0045's engagement claim, on the same object, in its own table. The household's
   side is unchanged (`signingAnother` already keeps it to one signature per need).
9. **What the mailbox sees is opaque.** A time is cut into cells of `SLOT_STEP_MIN` (15) covering
   `[start, end + buffer)`; a window-only time covers its window's cells. Each cell's token is HMAC-SHA-256, truncated
   to 16 bytes, of a label (`d:2026-11-05`, `daily`, `w:3`) and the cell's number, under a **slot key** that only the
   owner's phones hold. Because every slot's ends and every buffer are multiples of 15 minutes, two times share a cell
   exactly when they clash by the rule in §6, with no false clash. A booking said at any minute ("2:10") is rounded
   out to whole cells.
   - `POST /v1/inbox/slots` carries `take` (the cells to hold) and `free` (cells that must not be held by anyone
     else) and either holds all of `take` or holds nothing and says no. A dated time takes its dated cells and checks
     the `daily` and weekday cells at the same minutes. Recurring work takes its `daily` or weekday cells and checks
     the dated cells it would cover over `SLOT_HORIZON_DAYS` (28).
   - **Padding**: `take` and `free` are each padded with random tokens to `SLOT_TOKENS_MAX` (512) and shuffled, so the
     mailbox cannot tell a one-hour visit from a daily maid by count, or a cell's place in the day by order.
   - **The holder** is a random id the phone keeps with the job, never the engagement id, so the mailbox cannot join
     a claim to an engagement by id.
   - **Expiry** is `SLOT_CLAIM_TTL_DAYS` (60) from the claim, never the slot's own day or time, which an expiry would
     reveal. The holding phone renews recurring and far-off claims weekly while the job stands, and releases them
     (`DELETE /v1/inbox/slots/:holder`) when the job is cancelled or done.
10. **The slot key** is 32 random bytes with a random id, kept in the owner's own storage, so the QR move (ADR 0037)
    carries it to a new phone with everything else.
    - The first phone that needs a key and finds none makes one and registers its id with the mailbox; the first id
      wins (the object again), and a phone whose id lost discards its key.
    - The mailbox keeps one sealed copy per device (sealed to each device's encryption key from the directory, with
      `@gigsync/crypto`), never the key. A phone holding the key seals a copy for every one of the owner's devices that
      lacks one, each time it reads its own device list (every minute while it runs, `DEVICE_LIST_MS`). A new phone
      signed in without a move has no key until one of the others runs.
    - A claim names its key id; the mailbox refuses a claim under any other id, so two keys never hold cells side by
      side.
    - Rotation when a device is revoked is a later change. A revoked phone that knew the key can compute tokens, but
      the tokens are only useful to someone who also holds the mailbox's data.
11. **The agent checks before it proposes, not only at signing.** When the worker's agent builds its stance, the phone
    asks the mailbox which of a set of cells are held (`POST /v1/inbox/slots/held`): every cell of every day it may
    propose (the asked day and `DAYS_AHEAD` more), plus the `daily` and weekday cells, shuffled. A whole day's cells are
    asked, so the question says nothing about which minute the request is for. Cells held by another phone's jobs or
    bookings join `busy`, so the agent counters with a free time instead of negotiating one it cannot sign.
12. **When the claim is refused at signing** (the other phone signed in between): the phone does not sign. Its agent
    answers again with the held cells added to `busy` and sends a new quote with the next free time (allowed from
    `negotiating` and from `confirming`, `TRANSITIONS`) while rounds remain, else cancels with `slot_taken`, a new
    `CancelReason` sent only on jobs with slots (`no_deal` to older phones, which would reject an unknown reason).
13. **When the claim cannot be made** (no key yet, network, a stale key id):
    - with more than one live device in the owner's directory listing, the agent does not sign on its own: the deal
      waits for the owner with "Could not check your other phone's bookings; sign only if this time is free". The
      owner may sign; double booking is worse than a short wait, and only the worker can call a customer;
    - with one live device, nothing else can hold a clashing slot, so the local recheck decides, and the claim is
      queued and made on the next sync, so a second phone added later still sees it.
14. **Bookings claim too.** Saving a booking (ADR 0048) claims its cells under its own holder, and deleting it
    releases them, so the other phone's agent never agrees over it. The bookings themselves stay on the phone that
    saved them; the other phone only learns that some cells are held.
15. **An older phone of the same worker** never claims. While the owner has a device below `SLOTS_PROTOCOL`, a phone
    that claims cannot stop it, so the newer phone says once, on the schedule, "Update GigSync on your other phone so
    it cannot book the same time twice".

## Alternatives rejected

- **The losing phone follows `agree` envelopes.** The household's `agree` is sealed to every worker device, so the
  phone that lost the claim could note the agreed time. It is after the fact: two phones signing different requests
  within the same minute both pass before either sees the other's. It also misses half the cases, since the worker's
  own `agree` is sealed only to the household, and a worker who signs first leaves the other phone nothing to see
  until the household countersigns. It needs no new server state, which is why it was considered; it is a display
  aid at best, and it cannot prevent anything.
- **One phone answers every request.** A per-owner lease in the mailbox instead of a per-engagement claim. A lease
  must lapse to fail over, so requests wait while the leaseholder sits throttled in the background (an iPhone PWA),
  phone and laptop hand it back and forth, and the new holder still knows nothing of the old one's jobs and bookings,
  so it needs the schedule shared anyway. ADR 0045 rejected "the most recently active device" for the same reason.
- **Seal the schedule to the owner's other phones and check it locally.** Useful for showing one schedule (ADR 0048's
  cost), but two copies of a schedule are still checked apart, so it is racy for the same reason as following
  `agree`. Only one point that serializes calls can stop two signatures: one phone, or the mailbox.
- **Claim in the mailbox in plain text** (day and minutes). Simple, and the mailbox is ours, but it would hand the
  server every worker's clock times and every booking, which ADR 0040 and ADR 0048 keep on the phone.
- **Hold the slot when quoting, not when signing.** Fewer refused signatures, but a quote nobody signs keeps real
  work off the calendar for its whole life, and holds would need releasing on every walk-away. §11's check before
  proposing gets most of the benefit without holding anything.
- **Finer named windows** (one per hour) instead of minutes. Still equality between labels: no lengths, no buffer,
  and a 9:30 start fits no label.
- **A table in Neon.** A schema change the server does not need, and it would put times in the database.

## Stress tests and what this does not fix

- **The server can still learn a little.** It can match a claim to the job record that follows it by timing, and so
  learn that a set of tokens belongs to that record's day and window. It cannot learn the minute inside the window:
  token order is shuffled and count padded. Collisions tell it that two of a worker's times overlap, which a refused
  claim says anyway. Queries (§11) are made when a request arrives, so they say a worker is checking days near now.
- **The directory is still the root of trust.** The server could list a device of its own for the owner and receive
  a sealed copy of the slot key. That is the trust every sealed envelope already places in the directory; this adds
  nothing new to it.
- **Horizon.** A recurring job checks dated cells only `SLOT_HORIZON_DAYS` ahead, so a one-off job signed more than
  28 days out before a recurring one at the same time is not seen by it. Dated jobs always check recurring cells, so
  the other order is caught. Requests that far ahead are rare; the worker's own phone still sees its own clash.
- **Recurring work ignores its start date.** A daily job from 1 December blocks the same minutes in November. A free
  hour shown as busy is the cheaper mistake.
- **A fixed buffer** is wrong when two jobs are next door or across the city. Distance-based gaps need both jobs'
  places on one phone, which the worker's phone has from coarse location (ADR 0045 on saved addresses); a later change.
- **A phone that never runs** cannot renew its claims, and after 60 days its jobs stop blocking the other phone.
- **Payload.** A claim is 1,024 tokens of 22 characters (some 25 kB); a check about 900 (four days of 96 cells, the
  `daily` cells and those days' weekday cells). One per signature and one per request, not per message.
- **Times are local.** Minutes are on the clock where the work is. Both phones in a job are in one city, in India's
  single time zone; a phone set elsewhere shows the city's time, as `localNow` reads it.

## What an implementation touches

- `packages/protocol`: `terms.ts` (`TermWhen` slot and days, `SLOT_STEP_MIN`, `SLOTS_PROTOCOL`), `job.ts`
  (`slot_taken`), `job-record.ts` (`JobTermsFields.when` pinned to day and window), a new `slot-claim.ts` (token,
  claim, check and key-copy bodies, `SLOT_TOKENS_MAX`, `SLOT_CLAIM_TTL_DAYS`), `booking.ts` (`MINUTES_PER_DAY` shared).
- `packages/core/src/job`: `terms.ts` (`clashes` by minutes, `candidates`, `near`, `sameTerm`, `workerStance` with the
  working day and buffer), `terms-flow.ts` (`TermsTrack.slots`, the gate, `termsField` stripping, `bookedTimes` with
  minutes), `deal.ts` (claim in `sign`, re-quote or `slot_taken` on refusal, release on cancel), a new `slots.ts`
  (cells, tokens, padding, holders, renewals) and `slot-key.ts` (make, register, seal copies, read own copy).
- `packages/core/src/interview`: `need-terms.ts` (`slotOf`), `need-arrangement.ts` (weekly days), the need prompts
  (hours and days questions), `card.ts` (buffer); `schedule/windows.ts` (bookings as minutes, claimed and released).
- `packages/core/src/net`: `api.ts`, `paths.ts` (the slot and key routes on `Relay`).
- `packages/core/src/i18n` `en`, `hi`, `kn`: slot readback and sign lines, the two Find questions and their chips,
  the buffer question, the "could not check" and "update your other phone" lines, `slot_taken`'s reason.
- `workers/mailbox/src`: tables for slot claims, the key id and key copies; claim, check, release, key calls; the
  alarm's sweep. `index.ts` is at 192 lines, so the slot calls go in their own module.
- `workers/api/src/routes/mail.ts`: the routes, bodies validated with the protocol schemas and bounded by
  `SLOT_TOKENS_MAX`.
- `apps/mobile`: the slot on job cards, the sign screen and Activity; the card editor's buffer; weekday chips.
- Tests: core terms and slot tests (minute overlap, buffer, mixed window and slot, days), mailbox and API tests for
  the claim, and a browser test with one worker on two phones and two households asking for the same morning, which
  must end with one signed job.
- No Neon migration: claims and keys live in the Durable Object's own storage, and the job record keeps its columns.

## Consequences

- The single-phone recheck at signing that is being added separately stays: it is the check when the mailbox cannot
  be reached and the whole check for a phone on a job without slots.
- A maid's or driver's day can be agreed as it is lived, house by house, with a gap between, on GigSync and off it.
- A worker with two phones gets one booking per slot, at the cost of one call per signature, one per request, and a
  key the phones exchange through the mailbox without the server reading it.
- Jobs with older phones on either side behave as today: windows, equality, and on the worker's other phone nothing.
