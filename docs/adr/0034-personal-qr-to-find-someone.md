# ADR 0034: Every worker and household has a personal QR that finds them; it carries a replaceable code, never an id

Date: 2026-10-30. Status: accepted. Distinct from the colleague QR removed by [ADR 0031](0031-no-colleagues-mentor-links-only.md):
this QR opens no link and no chat. Brings back the camera, only when the owner taps Scan.

## Context

The founders want anyone to be able to show their QR so that the other person finds them and they can work together,
as in the collab app (a QR that is a link to you; the phone's own camera opens it; an in-app "Scan a QR" too). In
GigSync work always starts with a household's request to a worker (ADR 0014), and households have no public card.

## Decision

1. **The QR is a link with a short code**, `https://<app>/?to=<code>`, rendered on the phone. The code maps to the owner on
   the server and can be replaced at any time ("Make a new QR"), which ends the old one. A user id is never printed.
2. **A worker's QR** opens their card (name, trades, languages, area, usual rate) with "Ask {name} for work", which
   starts the same request a Find search would, to that worker alone; the agents negotiate as usual.
3. **A household's QR** shows the scanning worker only the household's first name and "Offer to work for {name}". The
   household receives "{worker} ({trade}) wants to work for you" with the worker's card and starts the request with one
   tap, so the household is still the one who asks. Nothing is sent until they do.
4. **Scanning**: the phone's camera opens the link (the app's link handling routes it after sign-in); the app also has
   "Scan a QR", which asks for the camera only then. On iPhone the home-screen app keeps its own storage, so the in-app
   scanner is the reliable way there.
5. **Abuse limits**: a code resolves only for signed-in users, at a capped rate per user; offers to work are capped per
   worker per day and per household; blocking a person (mentor block list) also blocks their offers.

## Consequences

- A new server table (codes) and routes; a new side envelope kind for an offer to work, behind a device protocol bump.
- The camera permission returns on Android and iPhone, asked only from the Scan button.
- A printed QR that is lost or shared too widely is fixed by making a new one.
