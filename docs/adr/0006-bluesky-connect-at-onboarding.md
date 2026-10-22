# ADR 0006: Every user connects a Bluesky account at onboarding

Date: 2026-10-23. Status: accepted. Amends ADR 0005.

## Decision

Connecting a Bluesky account is part of sign-up, not a step deferred to the first publish. Right after OTP the app
opens Bluesky's OAuth flow (sign in, or create an account on bsky.social) and links the resulting DID to the Collab
user in the directory. Every Collab user therefore has an AT Protocol identity and a repo for public records from
day one. The user never needs the Bluesky app; the account is an identity, like "sign in with Google".

The Bluesky session (refresh token and DPoP key) is stored in the encrypted database and included in the encrypted
backup, so a reinstall that restores the backup also restores the session. Collab never sees or stores the Bluesky
password.

## Why

- Without a DID, a user's public records (listings, wanted, reviews, public notes) have nowhere to live, and the
  marketplace side of Collab does not work for them. A user without one is in an "incognito" state we do not want.
- Doing it once at onboarding is simpler to explain than a surprise prompt at the first publish.
- No server to run (ADR 0005 still holds); Bluesky hosts the repo and the repo signing key.

## Recovery

| Situation | What happens |
| --- | --- |
| Normal use | The refresh token rolls over silently; no second login. |
| Reinstall with backup | OTP, then the PIN unlocks the backup; the DB, account key and Bluesky session come back. New device keys are certified by the account key. |
| Reinstall without backup | OTP, then "Continue with Bluesky" once more; the DID link in the directory is unchanged, so listings and reviews are intact. Private data is gone (new account key, safety code changes). |
| Bluesky password forgotten | Bluesky's own email reset; then one OAuth login. Nothing in Collab changes. |
| Session revoked or expired | A "Reconnect Bluesky" card; one OAuth login. Publishing queues in the outbox meanwhile. |
| Bluesky outage | Publishing pauses; search, messages and everything private keep working. |

## Consequences

- Onboarding has one more screen; sign-up on bsky.social needs an email. Drop-off at this step must be measured in
  the pilot; if it is high, ADR 0003's own PDS (DID created by our API, no Bluesky) is the fallback.
- Public records sit on Bluesky's servers in the US under Bluesky's terms; private data is unaffected.
- Handles are `name.bsky.social`; `name.collabai.network` can be offered later through a Worker serving
  `/.well-known/atproto-did`.
- Private chats and notes are never written to the Bluesky repo under any setting; only records the user publishes.
