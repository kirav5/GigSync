# ADR 0002: Cloudflare Workers and Durable Objects for the backend

Date: 2026-10-21. Status: accepted.

## Decision

APIs run as Workers. The directory and the search index are D1 databases. Each user's mailbox is a Durable
Object with its own SQLite. Files and backups go to R2. No other cloud is used, and no cloud model (ADR 0010).

## Why

- Free to start, pay per use after; no servers to run except the PDS.
- Workers run in several Indian cities, so the hop from the phone is short.
- A Durable Object per user spreads load across a million small boxes instead of one hot table.
- The mailbox and index already exist on this stack.

## Consequences

- D1 and Durable Objects cannot be pinned to India. Acceptable: private data never leaves the phone,
  protected data is sealed, public data is public. Payment data is never stored.
- Durable Objects are Cloudflare-only; leaving means rewriting the mailbox and index hub. Everything else
  is SQLite and HTTP and moves easily.
- Free-plan quotas (requests/day, rows written/day) mean moving to the paid plan before the pilot.
