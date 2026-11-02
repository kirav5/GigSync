# ADR 0036: A worker's card shows their record and household ratings, capped by what the server saw delivered; never a ranking

Date: 2026-10-30. Status: accepted. Narrows the [HLD](../gigsync/HLD.md) §2 non-goal "Ratings or ranking of workers by
GigSync": ratings households gave may be shown on the worker's own card; GigSync never ranks, sorts or filters
workers by them.

**Amended 2026-10-31:** the card shows two numbers, jobs done (stored jobs with status done, never agreed or
cancelled ones) and the rating with how many rated; "came back" is removed.

## Context

The founders want a worker's card, like the collab card, to show the work they have done and how households rated
it, so a household meeting them through a QR or the board can trust them. Jobs and ratings live sealed on the
worker's phone (the server never reads a job or a star). A count the phone publishes alone could be inflated by a
tampered app.

## Decision

1. **Three numbers on the card**: jobs done (signed by both sides), the average of the stars households gave with how
   many rated, and how many households hired the worker again. Shown on My card, the board card, the QR card and the
   offer card.
2. **Published by the worker's phone, capped by the server.** The phone computes the numbers from its own record and
   publishes them with its board card. The server counts, per worker, from envelope headers it already sees and never
   their content: engagements for which both sides delivered a signature, distinct reviewers who delivered a review on
   such an engagement (one per household per engagement), and households with two or more such engagements. To count a job only once both sides signed, and households that came back, it keeps one row per signature (signer, counterpart, engagement id) and one per counted review (subject, reviewer, engagement id): user and engagement ids only, never content, stars, prices or dates. That is a lasting record of who worked with whom, which the server did not keep before (it saw those ids only while delivering); the founders accepted it for this purpose on 2026-10-30. It serves each published number capped at its count. The average cannot be checked (stars are
   sealed); it is shown with how many rated, from the first rating (`MIN_RATED`, 1; it was 3 until 2026-11-02, when a worker who was rated saw "Not yet rated"
   and took the rating as lost).
3. **All or nothing.** The worker may hide the record from their card entirely (a switch in Privacy), never single
   ratings: the average is over every rating they received.
4. **Never a ranking.** Find, the board search and the agents never sort, filter or price by these numbers.

## Consequences

- Migration 0006 (signature and review id rows, record columns on the card); the mailbox route records them as
  envelopes are stored, from headers only.
- A worker can still inflate the average within the capped number of ratings; making each rating checkable (signed
  review receipts a viewer verifies) is the next step if that matters in the pilot.
- Fake household accounts cost a phone number each (sign-in by OTP); a worker creating many is not prevented here.
