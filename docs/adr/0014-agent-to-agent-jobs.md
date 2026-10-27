# ADR 0014: Jobs agreed agent to agent: board discovery, sealed envelopes, deterministic haggling, two signatures

Date: 2026-10-25. Status: accepted. Builds the G1 slice of HLD §7.1 and LLD §2–§4 on top of
[ADR 0004](0004-mailbox-not-nostr-relays.md) (mailbox), [ADR 0011](0011-upi-qr-payments-no-gateway.md) (UPI) and
[ADR 0013](0013-neon-postgres-directory.md) (Neon directory). The flow follows Collab's
(`collab/server/src/core/engage.ts`, `market/negotiate.ts`), moved from Collab's server onto each person's phone.

## Decision

1. **Discovery is a board in the directory.**
   - A worker publishes a public card with `PUT /v1/board/profile`: trades, an approximate area, a usual rate, languages.
   - Consumers search `GET /v1/board/workers?trade&lat&lon&radius_km&max_rate_paise`. Results are workers of that trade
     within the radius, nearest first.
   - Areas are stored rounded to 0.01° (about 1 km). The card holds no phone number or address.
   - Tables: `worker_profiles`, `worker_trades` and `worker_languages` (migration `0002_board.sql`).
   - Publishing the same card to Bluesky (LLD §7.5) can feed the board later without changing the search.
2. **Every message is sealed and signed on the phone.** `packages/crypto` handles both:
   - A fresh content key encrypts the body with XChaCha20-Poly1305.
   - X25519 with HKDF wraps that key once for each of the recipient's registered devices.
   - The sending device signs everything with Ed25519.
   - The API now checks the signature against the sender device's registered key and refuses anything else
     (`403 bad signature`); this removes `TODO(M2)`.
   - The receiving phone checks the signature again before it opens the body.
3. **The agents negotiate; the owners sign.**
   - The worker's agent declines trades and distances it does not serve. It asks each missing detail once (per-trade
     questions), then quotes the worker's usual rate.
   - The consumer's agent answers from what the owner already said, asks the owner only for the rest, and counters.
   - Both agents follow Collab's convex concession curve toward each owner's private limit (worker minimum, consumer
     budget). Neither limit leaves its phone.
   - An agent accepts an offer inside its limit that is as good as, or within 5% of, its own next one. It walks away
     (`cancel: no_deal`) after `MAX_ROUNDS` offers. No model sets a price.
4. **A deal needs two signatures on one terms hash.**
   - Accepting puts the terms in front of the owner (`confirm_deal`), unless the owner chose auto-confirm.
   - Signing sends `agree {terms, terms_hash, sig}`. The job is `agreed` only when both sides have signed the same hash.
   - New statuses: `negotiating` (offers) and `confirming` (one signature).
   - A consumer has at most one signature outstanding per need, so one need cannot be booked with two workers.
   - When one request in a fanned-out group is agreed, the others are cancelled as `taken`.
5. **Contacts move only after both sign.**
   - Each side then sends a `contact_release` carrying its contact card and the shared terms hash: the consumer's
     includes the address, the worker's the phone.
   - A card that arrives before agreement, or under another hash, is ignored.
   - A cancel deletes the other party's card.
6. **Payment and review use what exists.**
   - The worker's `payment_request` carries the UPI ID (sealed) for the signed amount. The consumer's phone builds the
     `upi://` link.
   - `payment_record` changes are accepted only from the side allowed to make them: the payer says paid; the payee
     confirms or disputes.
   - A `review` after delivery closes the job.

## Consequences

- Kinds: `counter` and `contact_release` were added instead of the LLD's `job_*` names. Bodies for every kind live in
  `packages/protocol/src/job.ts` (`BODY`) and are parsed after opening.
- The envelope gains `epk` and `keys`, which are signed like the rest. Envelopes from older clients are refused.
- `pnpm test` covers this with in-memory phones (`packages/core/test/job.test.ts`, `aftercare.test.ts`).
  `pnpm test:e2e` (`tests/e2e`) plays several consumers and workers against a running API and the Neon directory.
- Still open:
  - A hash-chained ledger and receipts (LLD §3.6).
  - Worker rules beyond trade, area and price (hours, flagged consumers).
  - Push wake-ups (FCM).
  - The app screens for both roles; the app still records jobs by hand until they are wired to `GigDevice`.
