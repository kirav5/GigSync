# ADR 0020: No ratings, anywhere: a closed job becomes a countersigned "worked together" receipt

Date: 2026-10-27. Status: proposed; amended 2026-10-31 (household stars, below). Companion to ADR 0018 §4; recorded separately because it binds every future
feature, not only the board.

## Context

HLD v0.1 listed "ratings or ranking of workers by GigSync" as a non-goal, yet the protocol carried a 1–5 star
`app.gigsync.review` record and the built G1 flow ([PR #8](https://github.com/kirav5/GigSync/pull/8)) ends a job
with a consumer's `review`. Domestic-worker unions have said that any worker-rating or paid verification layer
run by a platform will be read as surveillance and stigma
([The Wire](https://m.thewire.in/article/labour/fear-sold-as-safety-domestic-workers-groups-slam-hiring-platforms-seek-regulation);
[The Third Eye, "Verify the maalik, not just us"](https://thethirdeyeportal.in/structure/verify-the-maalik-not-just-us/)).
A rating is also the one thing a customer could hold over a worker after the contact grant has closed.

## Decision

1. No stars, scores, ranks or free-text reviews of a worker or a consumer exist in any schema, screen, export or
   board query, in any mode (worker, consumer, union, partner).
2. A job that reaches `closed` writes `worked_together { engagement, terms_hash, closed_at }` to both ledgers,
   countersigned like any receipt. Either side may add a private note to their own ledger; it never travels.
3. A board card may display a **count** of countersigned jobs. A partner handover or lender export may carry the
   count and the countersigned share. Nothing else derived from other people's opinions is ever displayed.
4. Safety signals go through the union flag (reason code, countersigned, expiring), never through a rating.

## Consequences

- `JobReview`, `K.review` and `COLLECTIONS.review` are removed; `delivered → closed` is reached by `worked_together`
  (or by the receipt timeout). `tests/ui` and `tests/e2e` lose their "rated" step.
- The index's "counted only when the engagement is delivered and both-signed" rule now applies to the count.
- Open: whether a consumer may see the count of a worker's _disputes_. Default no; the union's flag is the signal.

## Amendment (2026-10-31): a household's stars on the worker's card

The founders chose to show a rating, to build trust with households that do not know the worker. As built on
`feat/agents-negotiate` ([PR #12](https://github.com/kirav5/GigSync/pull/12); ADRs
[0036](0036-worker-record-on-the-card.md), [0038](0038-job-records-on-the-server.md)):
- After a job is done and paid, the household may give 1–5 stars, once per job.
- The server keeps the stars with the job record and shows, on the worker's card, their average to one decimal and
  how many jobs were rated, beside "Jobs done" (completed jobs only). The phone never sends these numbers.
- A worker may hide the record from the card; it then shows to nobody.
- No ranking: the board orders workers by distance and rate, never by stars, and nothing else in GigSync sorts or
  filters by them. Households are not rated.
- The "worked together" receipt and the rest of this ADR are not affected by this amendment where they stand on
  their own; the review step this ADR removed is kept as the star rating above.
