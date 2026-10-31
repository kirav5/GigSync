# ADR 0021: WhatsApp is a door into GigSync, never the agent, never the record

Date: 2026-10-28. Status: proposed. Extends ADR 0014 (jobs) and ADR 0004 (mailbox). Research in
`research_notes/GigSync WhatsApp and milestone payments/whatsapp_channel.md`.

## Context

Workers and households already live on WhatsApp (roughly 535 million Indian users), Vahan placed over a lakh
blue-collar workers through a WhatsApp recruiter bot
([Deccan Herald](https://www.deccanherald.com/business/placement-firm-vahan-says-placed-1-lakh-blue-grey-collared-workers-through-whatsapp-api-958351.html)),
and the biggest adoption risk in the roadmap is that a household will not install an app to hire a domestic
worker (ROADMAP risk 1). A WhatsApp interface would help both.

Three facts limit it. **Business-to-user WhatsApp is not end-to-end encrypted to the business:** Meta's Cloud API
holds the keys, decrypts every message, keeps it up to 30 days and forwards plaintext to the business and its
provider ([Meta data privacy](https://developers.facebook.com/documentation/business-messaging/whatsapp/data-privacy-and-security)).
Anything negotiated in chat is readable by Meta, the provider and GigSync's server, which breaks principle 3
("private data never leaves the phone readable") and puts a server in the middle of the job, which the whole
design refuses. **It costs per message:** since 1 July 2025 Meta bills each delivered business message, about
₹0.115 for a utility or authentication template and ₹0.86 for marketing in India, with service replies charged
beyond 1,000 a month from 1 October 2026, plus a provider markup of 0–26%
([Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md)).
**Meta controls the number:** quality ratings fall when users block a business, templates get rejected or
recategorised, and a business account can be disabled with no guaranteed reinstatement. A negotiation bot that
says no to households will attract blocks.

## Decision

1. **The agent, the negotiation, the terms, the contact cards and the record never pass through WhatsApp.**
   They stay in the app and in sealed envelopes. WhatsApp carries only two things: a short notice, and a link.
2. **For a household without the app, WhatsApp is the door to a web signer.** The worker's agent sends a utility
   template: "Priya's agent has terms for Tuesday's painting job. See and sign: <link>." The link is a one-time
   token to a GigSync web page where the household's browser creates a WebCrypto key, reads the terms, counters
   or signs, gets the worker's contact card only after signing, and pays by UPI link at each stage. Terms,
   contact and payment exist on that page and in the household's browser key, not in WhatsApp. The same page
   works from SMS.
3. **For a worker, WhatsApp is a notification and a menu, never an input for private data.** "You have a new
   request, open GigSync" (utility template, ₹0.115). A menu bot answers the things that hold no private data:
   the city guide, helpline numbers, registration field hints, "call my union". It never accepts an Aadhaar, an
   address, a rate or a job entry. A worker who prefers WhatsApp for everything is told plainly why the agent
   lives in the app.
4. **No Meta AI.** Meta's Business AI replies route through Meta's model and are switched off; GigSync's
   no-cloud-model rule (ADR 0010) applies to this channel.
5. **SMS is the fallback for every notification**, on a DLT-registered header at about ₹0.10–0.22 a message, so
   that a Meta restriction cannot stop a job. The record on the phone is the system of record either way.
6. **Costs are bounded:** about ₹1.2–1.5 per job if every notice is a template, near zero when the household
   replies inside the free service window. Budgeted in REVENUE.md as a per-job cost, never passed to the worker.
7. **DPDP:** the WhatsApp number and name are personal data held under explicit consent; nothing else is
   collected in chat. Circles, evidence packs and handovers stay in sealed envelopes and never touch WhatsApp.

## Why

- It solves the household-adoption problem without moving the job into a channel Meta can read.
- It keeps every security property of the design intact: the contact grant, the edge check and the ledger see
  the WhatsApp gateway only as a notifier.
- A door can be closed by Meta; a record cannot.

## Consequences

- New Worker `workers/wa-gateway`: templates, webhook for inbound menu replies, provider adapter (Gupshup or
  MSG91 class), SMS adapter, rate limits, quality-rating alarms. New routes: `POST /v1/wa/webhook`,
  `GET /s/:token` (the web signer, served by the static app Worker).
- New protocol: `WebSigner` (a consumer device whose key lives in a browser; lower trust, no background
  responder) and `Notice` (template id, variables, never free text from a model).
- The household's browser key is a device in the directory, so the mailbox, signatures and contact release work
  unchanged. Clearing the browser loses the key; the signed terms the household received as a PDF remain.
- Open: whether WhatsApp Flows with an encrypted endpoint can carry accept/counter/sign without Meta seeing the
  outcome (undocumented); pilot measures template approval delays and block rates.
