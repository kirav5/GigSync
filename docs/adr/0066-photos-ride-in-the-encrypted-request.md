# ADR 0066: Photos of the job ride in the encrypted request

Date: 2026-11-16. Status: proposed (asked for by the founders: "images only for now"). Builds on the encrypted
envelopes between phones (`packages/protocol/src/envelope.ts`) and the request a household sends
(`JobRequest`, `packages/protocol/src/job.ts`).

## Context

A household often knows the job best as a picture: the door off its hinge, the stain on the wall, the tap. Words are
hard for some of our users, and a picture also lets the worker judge the job before agreeing a price. The founders
asked for photo upload from the chat's "+", images only, and asked whether GigSync would store them.

GigSync has no file storage today, and holds no message content: a request travels between the two phones as one
end-to-end encrypted envelope, kept by the Mailbox only until the worker's phone collects it, at most
`MAX_CIPHERTEXT_CHARS` (128 KB) of ciphertext.

## Decision

1. A request may carry **up to two photos** (`MAX_PHOTOS`), each a **JPEG data URL** of at most `PHOTO_MAX_CHARS`
   (36,000) characters. The schema takes nothing else: no links, no other file types, no video.
2. **The household's phone shrinks each photo** before it is attached (`apps/mobile/src/adapters/photo.ts`): redrawn on a
   canvas at 960, then 720, 560 or 420 pixels on the long side, at falling JPEG quality, until it fits. Redrawing drops
   the original's tags, including where it was taken.
3. The photos go **inside the encrypted request**, to each worker asked. **GigSync stores no photo**: the server sees
   only ciphertext, as for every message, and the Mailbox deletes it once delivered. The photos are kept on the two
   phones with the job, as the rest of the job is.
4. Two full-size photos and the longest request still fit one envelope; a protocol test checks it.
5. An older worker phone drops the field unread (the schema strips unknown keys); the request still works.

## Consequences

- No new server storage, no new privacy surface, nothing to delete on GigSync later.
- Photos are small (about 25 KB each): enough to see a crack or a stain, not to zoom far into one.
- Each worker asked gets a copy, so a need sent to three workers stores the photos with each of the household's three
  jobs on its phone. Phone storage is fine for two small photos; a move to the encrypted phone database (M0 hardening)
  should keep them there.
- Video, more photos or full-size photos would need a different design (an encrypted upload with a short life), and a
  new decision.
