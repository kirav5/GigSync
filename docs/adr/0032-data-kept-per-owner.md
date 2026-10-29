# ADR 0032: Personal data is kept per owner on the phone; signing out hides it and never deletes it

Date: 2026-10-29. Status: accepted. Overrides [ADR 0025](0025-one-upi-id-in-profile.md) point 6 (signing out forgets
the UPI ID).

## Context

Many workers and households share one phone in the family. Until now the phone's records were not tied to anyone:
whoever signed in next saw the previous person's jobs, Passbook, private budget and mentor links. A first fix wiped
some of it at sign-out, which punished the common case (one person signing out and back in on their own phone) and
still left jobs and payments behind. The founders decided: keep per owner, never wipe.

## Decision

1. **One owner-scoped storage.** Every personal collection is stored under its owner (the signed-in user):
   jobs, tasks, needs and budgets, payments and payment requests, contacts, chat, engagements, outbox and inbox
   cursors, mentor links and notes, mentor requests and settings, blocks, memory, journeys, the UPI ID and personal
   settings. The core wraps the phone's storage once (`ownerPorts`); stores do not each scope themselves.
2. **Per phone:** the account record of whoever is signed in, the language, the model choice, downloaded public city
   guides, and the device keys.
3. **Signing out deletes nothing.** It ends the session and keeps the owner's card rules aside, so signing back in with
   the same number restores everything, card included. Another number signing in sees none of it.
4. **One-time claim.** Records written before this change belong to whoever signs in first after the update; a marker
   makes it run once per phone.
5. **The owner can still forget.** "What my agent remembers" keeps Forget and Forget everything.

## Consequences

- Mail never mixes: each owner's outbox and inbox cursor are their own, so one owner's queued envelope is sent only
  when that owner is signed in.
- Data at rest is separated by owner but not encrypted: someone who can read the phone's app storage could read it.
  Encrypting it with a key released after sign-in is the next step when needed.
- A lost or reset phone still loses everything; there is no backup.
