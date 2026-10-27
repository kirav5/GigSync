# ADR 0017: Circles are union-run peer groups; a mentor is a contact grant that expires

Date: 2026-10-27. Status: proposed. Extends ADR 0016 (landing).

## Context

A newcomer's first help in a city is other workers from their region, today through WhatsApp groups nobody
governs. Every global peer-community tool for gig workers failed on community-building, not on code
([Gigbox, Driver's Seat, Rodeo](https://civictech.guide/projects/gigbox)). Unions already hold the trust and the
groups: [TGPWU helped 62% of surveyed members register](https://tgpwu.org/wp-content/uploads/2024/04/TGPWU_ImpactEvaluationReport_2023_Digital-1.pdf).
GigSync's v0.1 design limited worker-to-worker contact to a union flag on purpose, so that no worker's story
travelled. The end-to-end vision needs worker-to-worker contact; the constraint that it be governed stays.

## Decision

1. **A circle is a union's group.** Key: home region × city × trade (any of the three may be "any"). It has a
   steward (a union organiser or an approved member) and a roster held in the directory as blind keys under the
   union's key. There is no circle without a steward; where no union exists, a vouched NGO may steward one.
2. **Joining is a request the steward approves.** A worker's join request carries their trade, home region and
   languages, nothing else. Approval writes the member's device keys into the roster so posts can be sealed to
   them.
3. **Posts are sealed envelopes, data not instructions.** A post (`circle_post`) is sealed per member device and
   fanned out through the existing mailbox when the circle has ≤ 50 devices; larger circles relay through the
   union's desk, which re-seals per member. A post never carries a phone number, an address or an exact
   location past the edge check; the steward can remove a member and the union can close a circle.
4. **A landing request is a post with a reply path.** The newcomer's agent posts `{ trade, home_region,
   languages, arrival_week, intended_area ~1 km }`. A member the steward has approved as a mentor replies
   `mentor_offer`. The newcomer accepts; only then does a `ContactGrant` with topic `circle` open on both sides,
   `closes_on: date`, 30 days, renewable by either side. The flag check (HLD 7.5) runs on the mentor's blind key
   and the newcomer's before either card moves.
5. **Mentoring is recorded, not rated.** Each side may write a `MentorReceipt` ("met at the station on the 12th";
   "helped open the bank account"), countersigned, into their own ledger. The union sees counts, never content.
6. **Nothing from a circle reaches a job.** A mentor's view of a newcomer never enters discovery or terms; the
   two are separate grants and separate ledgers.

## Why

- Governance by the union keeps GigSync out of the business of moderating strangers and gives newcomers a
  steward to complain to.
- Reusing the contact grant means the same code, vectors and revocation protect a newcomer meeting a mentor as
  protect a worker meeting a customer.
- Fan-out through the mailbox needs no new infrastructure for pilot-sized circles.

## Consequences

- New protocol: `circle.ts` (circle, join, roster entry, post, landing request, mentor offer, mentor receipt).
  New routes: `POST /v1/circles` (union), `POST /v1/circles/:id/join`, `GET /v1/circles/:id/roster` (member,
  device keys only), `POST /v1/circles/:id/relay` (desk). Grant topic `circle`. Ledger entries `MentorReceipt`.
- The union desk gains screens: circles, join requests, mentors, close circle.
- Threats added to the HLD security model: predatory mentor (steward approval, flags, expiring grant, ~1 km
  area), roster leakage (blind keys), spam (steward can remove; posts rate-limited per member).
- Open: who may become a mentor (any member, or steward-approved only; default steward-approved); whether a
  newcomer may post before arriving (default yes, so a bed and a mentor can be ready).
