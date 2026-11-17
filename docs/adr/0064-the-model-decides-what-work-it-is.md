# ADR 0064: The model decides what work it is

Date: 2026-11-09. Status: accepted. Revises [ADR 0047](0047-open-skills.md) §2,
[ADR 0056](0056-one-reader-for-every-message-in-find.md) and [ADR 0059](0059-kinds-of-work-behind-a-workers-own-words.md).

## Context

The run of all 62 kinds of work on Neon and the Mac Studio (8 November) sent 6 of 62 households to the wrong worker
or none, and left one worker without a card. Word lists caused most of it, and a model held to a short list did the
rest:
- The card interview took any trade word anywhere in an answer as that trade, so "water tank cleaning", "gas stove
  repair and burner cleaning" and "sofa and carpet shampoo cleaning" were all filed as **Maid**.
- Find's word lists overrode the model's correct reading: "daily car cleaning" became a maid's job though the model
  read car wash.
- With no worker filed under a kind, Find asked the model which of the board's unfiled names was "the same work". Held
  to a list of one or two names with null outside it, it always picked one: a water tank went to a geyser repairer, a
  sofa to a CCTV installer, even when the household had tapped the kind on the list.
- "Next month" and "for a week" made a priest's pooja monthly work and a nurse's dressings weekly, so no deal could be
  made.
- The card refused a comma and any name over four words, its own "Mixer and small appliance repair" included.

## Decision

1. **The model's reading decides the work and how it is hired.** Word lists never set either from free words, in the
   card interview or in Find. They still read what they are sure of: an area, a day, an amount, a tapped chip, a yes.
2. **A trade named outright stands** ("I need a plumber", "change my work to plumber"), as Find already did.
3. **With no reading, nothing is guessed.** Find asks which work and shows the list; the card interview keeps the
   worker's own words unfiled. The first read is retried once, since a dropped request is no reading.
4. **The card interview asks the model for the main kind**, by name from the list with "none of these" as one of its
   lines; the worker confirms with one tap ("Is this water tank cleaning?"). When the word lists find the trade the
   model named, nothing is asked. Words the card cannot hold as they are go on it under the kind's own name.
5. **A tapped kind is never replaced.** With nobody filed under it, Find says so and shows the others in its group.
   For typed words the "same work" call stays, with "none of these" as a line and a second yes-or-no call on the name
   it picks.
6. **Find's reader also says how the work is paid for** (`hired`: hourly, visit, weekly, monthly or null).
7. **Kinds a small model confuses get a line saying what they cover** (`skills/work-scope.ts`), shared by both
   readers.
8. A skill may hold a comma and five words.
9. **A phone waits for the API's word on its model** before its first model call (up to 4 s): a worker who answered the
   first question seconds after signing up was read as if there were no model, and the word lists no longer cover it.

## Consequences

- One more tap for a worker whose words are not a trade or a kind's exact name. A worker with no model reachable keeps
  their own words, unfiled, until My card files them.
- Find makes no guess when the Mac Studio cannot be reached: a household sees the list instead.
- `pnpm eval:find --reader turn`, with the run's failures added as the `run` set: right job 97% on the original 125
  conversations against 98% before (readback 97% against 99%), and 100% on the run set. The one conversation lost is
  Kanglish house cleaning ("mane cleaning mattu paatre tolyoke"), which the model now reads as sofa cleaning where the
  word "cleaning" made it a maid's; the word lists were right there by luck, and wrong for every worker whose work
  merely contains the word.
- How it is paid for: 14 of 15 test sentences read right, "next month" and "3 hours on Saturday" among them. "Dressings
  daily for a week" reads as monthly work, so a nurse at a visit's rate and a household budgeting by the month may not
  agree; the household can change it at the readback.
- The 16 kinds re-run end to end on Neon and the Mac Studio: 15 signed, the nurse above talked without signing.
- Each offer note is worded once per model, not on every draw of the job card; the run's `explain` calls halve.
