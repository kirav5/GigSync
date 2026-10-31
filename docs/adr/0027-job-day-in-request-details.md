# ADR 0027: A job's day travels as `details.day`, its time as `details.time`, with no protocol change

Date: 2026-10-29. Status: accepted. A convention on top of `JobRequest.details` (ADR 0014); superseded once
`JobTerms` gains a real schedule (ADR 0018 §2, ADR 0022, proposed).

## Context

Today, the worker's home screen, should list the jobs that happen today, then the ones coming up. The only "when" a
request carried was `JobRequest.when`, the household's free text ("kal subah"), which reaches the worker through
machine translation. A screen cannot sort by translated text, and a translation can change a day word without
warning.

## Decision

1. **Find's When is four chips:** Today, Tomorrow, Pick a date (a date input), Every day. The default is Every day
   for monthly trades (cook, maid), otherwise Today. An optional time field ("Time (if it matters)") sits under them.
2. **The chip writes `details.day`:** an ISO date ("2026-10-29") in the household phone's own calendar, or `daily`
   (`EVERY_DAY`). The time writes `details.time`, free text for people only, at most 60 characters.
   `JobRequest.when` still carries the day and the time as words, for older phones and for the agent: the date
   itself in the household's language for Today, Tomorrow and a picked day, never "Today" or "Tomorrow" (they are
   true only on the day they are sent, and Hindi "कल" is also yesterday), or "Every day".
3. **Why no protocol change:** `details` is already `record<DetailKey, shortText>`, `DetailKey` is a free pattern, and
   details already flow into the signed `scope`, so there is no terms version bump.
4. **Reading it** (`packages/core/src/job/when.ts`): `dayOf` accepts only an ISO date or `daily`, since the value is
   the other phone's free text until checked. `isOnDay` is true for the same day, `daily`, or a monthly trade that has
   started (or never said when); `isAfterDay` for a later single day. `localDay(now, offsetMinutes)` gives the
   phone's own calendar day.
5. **Showing it:** each phone renders the day itself with `date()` in its owner's language, never through
   translation; `details.time` goes through `Said` like other free text. `day` and `time` are left out of the generic
   details list on the job card. The worker's quote copies `JobRequest.when` into the signed slot, so with a day the
   Deal line leaves the slot out and the When line says it once; a request from before the chips shows its slot.
6. **Today's sections** (`screens/jobGroups.ts`): Decide now; Today's jobs; Coming up; Other jobs (active jobs from
   before this change, or a one-off day that has passed without the job being marked done); the jobs still being
   negotiated (folded); Earlier (folded): jobs that are over, and one-off jobs delivered and paid. A job paid before
   the work is done (cash at the door) stays where its On my way and Mark done can be reached.

## Why

- The day is the part of "when" that sorts a worker's day, and it becomes a structured field each phone renders in
  its own language, which removes it from the free text that gets machine-translated.
- It costs nothing in the protocol and stays readable by phones that do not know it.

## Consequences

- **The day is fixed when the request is made.** The signed slot is a copy of `JobRequest.when` that no step of the
  negotiation changes, so the two cannot disagree; agreeing on another day takes a new request until `JobTerms` has a
  schedule.
- **Jobs from before the change** have no day and show under Other jobs.
- **Monthly work counts as every day**, which is right for a cook and wrong for a weekly cleaner; a proper
  `JobTerms.schedule` (weekdays, start and end) is a protocol change for a later round.
- **The time is still free text** and still machine-translated on the other phone; the number guard catches only
  changed digits.
