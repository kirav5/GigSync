# ADR 0037: The server holds each worker's record and stars; earnings reach it only by consent; phones move by QR

Date: 2026-10-31. Status: accepted. Amends [ADR 0036](0036-worker-record-on-the-card.md) §2 (the record is no longer
published by the worker's phone) and narrows the HLD's "no central database" stance for three fields.

## Context

The founders want a worker's trust to survive a reinstall or a new phone: how many jobs she concluded and her rating
across all of them, held by GigSync. Job content stays on the phones. They also want analytics on jobs and revenue per
worker, and a way to move to a new phone.

## Decision

1. **Stars on the server.** With a review, the household's phone also sends the server the number of stars only (the
   review's words stay sealed): `{ worker, engagement, stars }`. The server accepts it only for an engagement both
   sides signed (ADR 0036 counting), one per household per engagement (a later one replaces it), and computes the
   worker's record itself: jobs, the average of stars and how many rated (shown from 3), households who came back.
   Cards serve this record; the worker's phone no longer publishes one. Privacy's "Show my record" stays (all or
   nothing). The server knows which household gave which stars to which worker; only the average is ever shown.
2. **Earnings by consent, per worker.** A worker may agree, once and revocably, to share earnings with GigSync for
   analytics; never shown to anyone. Her phone then sends monthly totals for finished jobs (count and rupees, by trade
   and city), replacing that month's totals on each send; turning it off stops sending and deletes what was sent. No
   job details, households or dates beyond the month. Default off; asked once after the first paid job.
3. **Moving to a new phone.** The old phone encrypts the owner's data with a fresh key, uploads the ciphertext to a
   transfer slot that expires in 15 minutes, and shows a QR carrying the slot and the key. The new phone, signed in as
   the same number, scans it, downloads, decrypts and keeps everything; the old device is then revoked. The server only
   ever holds ciphertext, briefly. A lost phone keeps its record on the server but loses its job history (an encrypted
   backup remains possible later).
4. **Card refill.** After signing in on a phone without the worker's card rules, the app refills the public card from
   the board and asks only for the private lowest price.

## Consequences

- New tables: stars per (worker, household, engagement); monthly earnings per consenting worker; transfer slots.
- Income is the most sensitive figure the server holds; access is limited to aggregate analytics queries, and a worker's
  deletion removes hers. Under India's DPDP Act this is consented personal data with a stated purpose.
