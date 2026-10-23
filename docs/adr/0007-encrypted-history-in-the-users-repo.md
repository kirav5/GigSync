# ADR 0007: Private history is synced as ciphertext in the user's own AT Protocol repo

Date: 2026-10-23. Status: accepted. Amends ADR 0005 and 0006.

## Decision

Chat history and the agent's episodes are encrypted on the phone and written to the user's own repo on their PDS
(Bluesky's today) as records in the collection `network.collabai.private.history`. The key never leaves the
user's devices: it is held in the Keystore-wrapped store, in the PIN-wrapped backup, and in Block Store. Live
data stays in the encrypted database on the phone; the repo copy is for sync and recovery and belongs to the user.

| Store | Holds | Key |
| --- | --- | --- |
| Phone, SQLCipher | everything, live | Keystore AES key |
| User's repo, `private.history` records | daily chunks of episodes and threads, ciphertext only | history key (XChaCha20-Poly1305), on the device |
| PIN-wrapped backup (Downloads, optionally R2) | full snapshot plus the account key, the history key and the Bluesky session | recovery PIN (Argon2id), Block Store |
| Shared-PII vault | values other people released to this user, time-boxed | device only; excluded from the repo and, by default, from the backup |

Record shape: `{ v, keyId, nonce, ciphertext, size }` and nothing else. Conversation ids, counterpart DIDs and
text are inside the ciphertext. Chunks are written once a day in fixed-size pieces, padded, so write times and
sizes say little about activity. Large chunks go as blobs referenced from the record. The index ignores the
collection; the Jetstream filter in `workers/index` never subscribes to it.

Reinstall: OTP, then Bluesky OAuth, then the chunks are fetched from the repo and unlocked with the history key
from Block Store, the backup, or the PIN; the phone rehydrates the database. Without the key the chunks are dead
data.

## Why

- The user owns the copy, can read it with any AT Protocol client that has the key, and takes it along when they
  move to another PDS. Nothing of ours needs to run for recovery to work.
- One sync mechanism also serves several devices of the same user.
- It keeps the promise that no server, ours or Bluesky's, can read private data.

## What this does not hide, and what we do about it

- The repo shows that encrypted records exist, how many, how large and when written. Daily, padded chunks keep
  that signal low. Record keys are TIDs and encode write time; that is accepted.
- Deletion is not guaranteed network-wide: relays and mirrors may keep copies. Deleting the records and rotating
  the history key makes old copies unusable.
- Losing every copy of the key loses the history, as in any end-to-end design. Onboarding shows the recovery code
  once and the backup is created immediately.
- bsky.social enforces write rate limits and blob size caps; chunking stays within them and the backup file is
  the fallback if a PDS refuses writes.
- Values other people released to this user (phone numbers, addresses) do not go into the history chunks: they
  stay in the shared-PII vault on the device, with their own expiry, and the history carries placeholders.
