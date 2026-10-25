# ADR 0002: Cloudflare Workers, D1 and Durable Objects instead of Google Cloud + Postgres

Date: 2026-10-21. Status: accepted; the directory part is superseded by
[ADR 0013](0013-neon-postgres-directory.md) (Neon Postgres through Hyperdrive).

## Decision

APIs run as Workers. The directory and the search index are D1 databases. Each user's mailbox is a Durable
Object with its own SQLite. Files and backups go to R2. Google Cloud is used only for Gemini and analytics.

## Why

- Free to start, pay per use after; no servers to run except the PDS.
- Workers run in several Indian cities, so the hop from the phone is short.
- A Durable Object per user spreads load across a million small boxes instead of one hot table.
- The index already exists on this stack (carried over from the Swift app).

## Consequences

- D1 and Durable Objects cannot be pinned to India. Acceptable: private data never leaves the phone,
  protected data is sealed, public data is public. Payment data is never stored.
- Durable Objects are Cloudflare-only; leaving means rewriting the mailbox and index hub. Everything else
  is SQLite and HTTP and moves easily.
- Free-plan quotas (requests/day, rows written/day) mean moving to the paid plan before the pilot.
