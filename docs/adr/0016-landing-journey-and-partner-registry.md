# ADR 0016: Landing in a new city is a journey in the agent, delivered through a vouched partner registry

Date: 2026-10-27. Status: proposed. Extends the HLD to the founders' end-to-end vision ([VISION.md](../gigsync/VISION.md)).

## Context

About half of India's delivery workers are migrants (24% intra-state, 26% inter-state per
[IDinsight, 2025](https://www.idinsight.org/article/the-changing-landscape-of-work-insights-into-indias-delivery-platform-gig-workforce/)),
and nobody serves the first two weeks after arrival: housing runs through village landlords with no contracts,
the one blue-collar co-living product at the right price is [Nia.one](https://inc42.com/startups/how-nia-is-fixing-indias-gig-economics-by-giving-workers-a-home-away-from-home/)
(about ₹1,500 a bed), the government's rental scheme (ARHC) is stalled, fake "placement" agents charge
registration fees, and a worker with no city address is refused a bank account despite the
[2019 self-declaration rule](https://www.bloombergquint.com/aadhaar/govt-eases-norms-for-change-of-address-on-aadhaar).
GigSync's v0.1 docs did not mention any of this.

GigSync cannot own beds, lend money or run a hostel, and should not try: Nia.one is real estate plus a staffing
commission; a lender is a balance sheet. What GigSync has that none of them have is a worker who arrives with a
verified record and a consent.

## Decision

1. **Landing is a journey in the agent, not a page.** `core/landing` keeps a state machine per move:
   `planning → travelling → arrived → housed → documented → registered → working → settled`, each with a
   checklist the worker ticks or the ledger ticks for them (a housing receipt ticks `housed`; a UAN ticks
   `registered`; a both-signed agreement or a platform-shift receipt ticks `working`). Every step works offline.
2. **City content packs are signed data.** A pack per city (rest points, helplines, union office, document rules
   with the exact rule to quote, going rates from aggregate countersigned records, kit and vehicle costs) is
   authored by GigSync with the union, signed with GigSync's content key, versioned, under 2 MB, served from R2
   and downloaded on Wi-Fi. A pack is data: nothing in it can trigger an action, open a grant or send a message.
3. **Partners live in a public registry, vouched by a union.** A partner row: kind (`housing`, `skilling`,
   `lender`, `helpline`, `ngo`), cities, what it offers, price, rules, a public key, and the union that vouches
   for it (signed). Only vouched rows are shown. The registry answers queries by city, kind and area; it never
   returns workers.
4. **A handover is one worker's consent.** A worker who chooses a partner sees a confirm card listing exactly the
   fields going out (name, phone, trade, arrival date, and optionally a record slice such as "worked 40 days in
   the last 3 months, countersigned"). It is sealed to the partner's device, or exported as a signed file where
   the partner has no GigSync. It is logged as a disclosure and can be revoked like a contact grant. A partner
   cannot query, list or be pushed workers.
5. **The booking happens with the partner.** GigSync shows the offer and records the receipt the partner returns
   (a bed, a seat, a loan offer). GigSync takes no referral fee in the pilot; a fee, if ever, needs its own ADR.
6. **The cash plan is arithmetic, not credit.** From the pack and the worker's plan (platform, vehicle, kit), the
   agent shows the likely cash needed before the first payout and the first payout date. A lender appears only
   as a vouched partner the worker can choose.
7. **Documents are a checklist with the rule to quote.** Aadhaar address change, SIM, bank account on a
   self-declared address, UPI ID, police verification where a household asks for it. Each item carries the form,
   what to carry, and the sentence to say when refused. GigSync never fills a government form for the worker.

## Why

- The journey is the vision; the partner registry is the only honest way to deliver beds and credit.
- Vouching by a union keeps fake partners out and keeps GigSync from becoming a lead marketplace.
- Signed packs give an offline city guide on a 4 GB phone with no model and no network.
- Handover-as-consent is the same primitive as the contact grant, so it reuses `decide()`, the edge check, the
  disclosure audit and revocation.

## Consequences

- New protocol: `landing.ts` (journey, steps), `partner.ts` (registry row, vouch, handover, partner receipt),
  `content.ts` (pack manifest). New routes: `GET /v1/partners`, `POST /v1/partners` (union-signed),
  `GET /v1/content/:city`. New grant topic `handover`. New ledger entries `Handover`, `PartnerReceipt`.
- GigSync holds a content signing key; a compromised key could ship a bad pack, so packs are also pinned to a
  version list in the app release and the union reviews each pack.
- The first pack is Bengaluru; the pilot union co-authors it. A city without a pack still gets the journey and
  the checklist, without local content.
- Open: the first housing partner and the terms for the worker; whether a partner receipt without GigSync (a
  signed file) is enough evidence for a dispute with that partner.
