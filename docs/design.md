# Collab: high-level design

The full design, with diagrams and the edge-case table, is the design page:
https://claude.ai/artifact/D9PVAZDXXcPaisaB8BwzT4 (version 0.2, Cloudflare backend). This file is the short
form that lives with the code. Decisions are recorded in `docs/adr/`.

## In one paragraph

Every person has an agent on their phone. It keeps their notes and context on the device, answers for them
under rules they set (grants), and asks other agents on their behalf. Businesses and providers have worker
agents. Agents talk through one object, the engagement, carried in signed, end-to-end encrypted envelopes
through a mailbox on Cloudflare. Public data (worker profiles, listings, public notes, reviews) is owned by
the user in an AT Protocol repository on our PDS; D1 keeps a searchable copy.

## Where data lives

| Tier                            | Original                | Copies                                                                                | Who can read                                     |
| ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Private (notes, chats)          | Phone, encrypted SQLite | Encrypted backup in R2, key never on server                                           | Owner only                                       |
| Protected (free/busy, location) | Phone                   | Sealed envelope in the recipient's mailbox until acked; a copy on the contact's phone | Contacts a grant names, at the granted precision |
| Public (profiles, listings)     | User's repo on our PDS  | D1 index, edge cache                                                                  | Anyone                                           |

## Pieces

| Piece                                   | Where                     | Code                |
| --------------------------------------- | ------------------------- | ------------------- |
| Agent core                              | Phone (TypeScript)        | `packages/core`     |
| Protocol schemas                        | Everywhere                | `packages/protocol` |
| App shell and UI                        | Phone (Capacitor + React) | `apps/mobile`       |
| Native plugins                          | Phone (Kotlin, Swift)     | `plugins/*`         |
| API: sign-in, directory, mailbox routes | Cloudflare Worker + D1    | `workers/api`       |
| Mailbox                                 | Durable Object per user   | `workers/mailbox`   |
| Search index                            | Worker + D1 + IndexHub DO | `workers/index`     |
| PDS                                     | VM in Mumbai              | `infra/pds`         |

## The path of one question (Asha asks her mother when she is free)

1. Asha types; the on-device router picks the "ask contact" expert and drafts an engagement.
2. Asha confirms. The app signs and seals an envelope and puts it in the outbox.
3. The outbox posts it to `POST /v1/mailbox/:mother`; the mailbox object stores one copy per device.
4. No device is connected, so a wake-up goes to FCM. Mother's phone fetches, acks, verifies the signature.
5. The policy engine checks mother's grants: "family may see free/busy, automatically" → answer without
   asking. Free-text questions would wait for her.
6. The answer comes back the same way. Both phones write an audit entry. The mailbox has deleted both envelopes.

## Milestones

M0 foundation (this repo) → M1 own agent with on-device model → M2 person ↔ person → M3 person → worker with
PDS and index → M4 worker → worker and hosted workers → M5 hardening and pilot.
