# ADR 0005: Public data lives on Bluesky's PDS, not one we run

Date: 2026-10-21. Status: accepted, amended by ADR 0006 (connect at onboarding, not at first publish). Supersedes ADR 0003.

## Decision

Worker profiles, listings, public notes and reviews are AT Protocol records in the user's own repository on
Bluesky's PDS (`bsky.social`). We run no PDS. The user connects their Bluesky account to Collab with AT Protocol
OAuth, and the app writes Collab's records (`packages/protocol/src/records.ts`) into that repository. The index
Worker reads them from Jetstream and keeps the searchable copy in D1, rebuildable from the relay.

## Why

- No server to run, patch or back up outside Cloudflare.
- The user still owns their public data: signed, portable, verifiable by anyone, movable to another PDS.
- The index already follows Jetstream for Collab collections and backfills from the relay, so it works unchanged.

## Consequences

- Accounts cannot be created silently at phone sign-in; Bluesky's sign-up has its own verification. Users
  connect a Bluesky account, asked for only when they first publish something public, not to use the app.
- Handles default to `<name>.bsky.social`. `<name>.collabai.network` stays possible later: a Worker can answer
  `/.well-known/atproto-did` for each subdomain, no server needed.
- Public records sit on Bluesky's servers in the US and follow Bluesky's terms and write rate limits. Private data
  is unaffected: it never leaves the phone.
- A Bluesky outage pauses publishing; search keeps answering from D1.
- `infra/pds` is no longer deployed. Running our own PDS stays possible later, and users could move their repos to it.
