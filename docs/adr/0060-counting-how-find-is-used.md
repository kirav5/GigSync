# ADR 0060: Counting how Find is used

Date: 2026-11-07. Status: accepted.

## Context

A review proposed putting the trades' grid back on Find's first screen, which would reverse
[ADR 0051](0051-questions-that-fit-the-job.md). Both sides of that argument rest on how often people tap and how often
they type, and nothing measures it. Nor does anything say how often Find reads the work wrong.

## Decision

1. **Find counts four events per day:** a first message typed, a trade tapped from the list, "Not this", and the work
   changed at the readback (`FindEvent`). `POST /v1/find/count` adds one, and `GET /v1/admin/analytics/find` reads them.
2. **`find_counts` (migration 0017) holds a day, an event and a number.** No user, no words, no work. It can say how Find
   is used and nothing about anyone. The session only keeps strangers out, and is not stored.
3. **A count never gets in the way.** Nobody waits on it, and one that fails is not counted.
4. **The grid stays behind its chip until these counts exist.** The decision is left for the pilot's numbers.

## Consequences

- A greeting is not counted, and a chat that only asks a price is counted as typed.
- Counts are not users: one person retrying counts twice, so they show proportions and not people.
- The Privacy page needs no change, since nothing about a person is kept.
