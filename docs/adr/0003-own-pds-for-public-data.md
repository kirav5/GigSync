# ADR 0003: Public data lives on our own AT Protocol PDS; D1 is only an index

Date: 2026-10-21. Status: superseded by ADR 0005 (Bluesky's PDS instead of our own).

## Decision

Worker profiles, listings, public notes and reviews are AT Protocol records in the user's repository on a PDS
we run in Mumbai. Every user gets a DID and a handle automatically at sign-up. The D1 index is a copy fed
from the PDS event stream and can be rebuilt from it.

## Why

- The user owns their public data: signed, portable, verifiable by anyone, movable to another PDS.
- Keeps GigSync's promise that the server is never the source of truth for a person's data.
- The same pattern (PDS → stream → index) already runs in the Swift app.

## Consequences

- We run one server (the PDS). Daily backups to R2; a standby region later.
- Public records are near-permanent once published; the app warns before the first publish and blocks phone
  numbers and exact addresses in public records.
- We do not use the Bluesky app, bsky.social accounts, or (in v1) the Bluesky relay and Jetstream; we read
  our own PDS's stream. `did:plc` vs `did:web` is still open.
