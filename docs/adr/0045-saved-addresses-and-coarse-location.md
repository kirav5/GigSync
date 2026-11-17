# ADR 0045: Saved addresses, current location and a coarse point off the phone

Date: 2026-11-02. Status: accepted. Amends [ADR 0039](0039-market-prices-and-expiring-contacts.md) §1 (a job's area is
any locality, not only the five pilot areas) and the sign-in screen (no free-text address).

## Context

A test on 2026-11-02 found the place both sides see is effectively fixed. The household typed an address once, as free
text, at sign-in; Find then asked for one of five pilot areas, and every place the code could not match fell back to
the first of them (`AREAS[0]`, Indiranagar) on the board card, in My card and in Find's search. A household in
Banashankari was searched for, and shown to workers, as Indiranagar. The address sent after signing was whatever was
typed at sign-in, whichever home the job was for.

Urban Company and Snabbit both do the same thing here: "Use current location" with a permission explanation first, a
pin to confirm, a search box as the fallback, then house/flat, building, landmark and a Home/Work/Other label, saved
so the next booking picks one. Neither shows the door to a professional before the booking is confirmed.

## Decision

1. **Saved addresses live on the phone only.** A household keeps several (`SavedAddress` in
   `packages/protocol/src/address.ts`): house or flat number, floor, building or society, street, landmark, area
   (locality), city, PIN code and a label (Home, Work, Other), plus the exact point when they used their location. They
   are stored in the phone's own storage (`Collection.addresses`), never on the server, and moved to a new phone with
   the rest of the owner's data. Sign-in no longer asks for an address.
2. **Picked per request.** Find's "where" question offers the saved addresses as chips and "Add an address". The
   chosen address goes on the household's `Need` as its site; when both sides have signed, `contact_release` carries
   that address, as one line, to the worker's phone. Before signing, the worker's phone sees only the locality name
   (`JobRequest.locality`) and the coarse point.
3. **Only a coarse point leaves the phone.** Every point the phone sends (the request's area, a board search, a
   worker's base, a reverse-geocoding lookup) is rounded to two decimal places of a degree, about 1.1 km
   (`coarsePoint`), the same grid the board already stores. The exact point never leaves the phone.
4. **Geocoding: Ola Maps, behind our Worker.** `GET /v1/geo/reverse?lat&lon` (coarse point → locality, city, PIN) and
   `GET /v1/geo/search?q` (typed text → up to five places) call Ola Maps (Krutrim) from the API with the key in the
   `OLA_MAPS_API_KEY` secret. The phone never talks to the geocoder, so the provider sees neither the owner's IP nor
   their session; it sees a 1.1 km cell or the words typed. Results are cached at the edge (Cache API, 30 days) by
   rounded point or normalised query, and coordinates are never logged. Without the key the routes answer 503 and the
   app falls back to typing the address and picking the area from the list.
5. **No third-party map tiles.** The "use current location" step is a confirm step (locality, city and PIN to accept or
   edit), not a map. Map tiles are fetched by the phone at the zoom of the point shown, so any tile host would learn
   the owner's position to the building. A map can come later from tiles we serve ourselves.
6. **Workers set a working area and a radius.** My card takes the area from the pilot list or from their location, and
   a radius (3, 5, 10 or 25 km). The base is stored coarse, as before; the radius stays on the phone, where
   the worker's agent declines requests from further away.
7. **Areas beyond the pilot five.** A place's area key is the nearest pilot area within 3 km of the point, else the
   locality's slug ("banashankari"); estimates group GigSync's jobs by that slug (ADR 0039 §1). A pilot area is shown
   in the reader's language; any other locality as the geocoder named it.

## Geocoding source: cost and privacy

| Source                | Works on Workers        | India data                             | Cost at pilot scale                                                                                                                                                                | Privacy                                                                                             |
| --------------------- | ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Ola Maps (chosen)** | `fetch` with an API key | Built for India: localities, PIN codes | Free up to its monthly allowance (500,000 reverse-geocoding calls on the pricing page as read on 2026-11-02; Ola's 2024 announcement said 5 million), then a small per-call charge | Indian company; sees a 1.1 km cell or typed words, from our Worker's IP                             |
| Google Geocoding      | Yes                     | Best coverage                          | India pricing: a free monthly allowance per product, then pay per 1,000 calls                                                                                                      | Sees the same; its terms want results shown on a Google map                                         |
| OSM Nominatim         | Yes                     | Patchy PIN codes in Indian suburbs     | Free, but at most one request a second for the whole app and no autocomplete                                                                                                       | Open data; fine for development, not for production use                                             |
| On-phone gazetteer    | No network              | Only what we bundle                    | Free                                                                                                                                                                               | Best: nothing leaves the phone. Needs a sourced list of localities and PIN codes we do not have yet |

Ola Maps wins on Indian PIN and locality coverage at no cost for the pilot. Because the provider only ever sees our
Worker's coarse lookups, switching to Google or to a bundled gazetteer later changes one module
(`workers/api/src/geo/ola.ts`), not the phone.

## Consequences

- The user must set `OLA_MAPS_API_KEY` with `wrangler secret put` before "Use current location" and search work in
  production; until then the manual form works everywhere.
- A household with no saved address can still ask by area alone (the pilot chips); the worker then gets the name and
  phone number but no address after signing, as before when the sign-in field was left empty.
- The locality a 1.1 km cell resolves to can be wrong near a boundary. The confirm step shows it for the owner to fix,
  and the area only steers the estimate and the search; the address the worker gets is the one the owner wrote.
- Older phones read `JobRequest.locality` as an unknown field and drop it; nothing they sign changes.
- An address typed at sign-in by an older build cannot become a saved address (it has no PIN code or area to check),
  so it stays what it was: the line a worker gets after signing a need that has no saved address. Find asks for a
  saved address from then on.
- When the owner names a pilot area in their own words and has exactly one saved address there, that address is the
  one the need is for; with two or more, they pick at the "where" question.
- With search off (no key) and nothing in the typed words that names a pilot area, the form asks which pilot area
  the address is nearest to, so the request still has a point to search from.

## Update 2026-11-16: a searched place at its own point, and suggestions as the owner types

A household picked "LGCL Bamboo Forest Villas" and the form said Parappana Agrahara: search rounded every suggestion
to the 1.1 km cell and named the cell, so the pin landed up to 600 m away and the area could be the next locality
over (the villas are in Choodasandra). A place someone searched for is public, not the owner's location, so:
- `/v1/geo/search` returns each suggestion at Ola's own point (`precisePoint`, five decimals, about a metre), and
  names it from a reverse lookup of that same point, done by the API, taking the area its own line names before the
  city (Ola's address parts and its line can disagree). The naming is cached by point, so the searches made while
  typing share it. Answers are filed under a new cache name, so no coarse answer is served again.
- The owner's own fix is unchanged: "Use my current location" still sends only the coarse cell, the API still
  rounds it again, and the phone keeps its own precise point for the pin and the saved address.
- The app suggests as the owner types (three letters, then a pause of about 350 ms; one request at a time, the
  latest words win; Enter still searches at once), and passes the centre of the city in use, rounded to the coarse
  grid, which the API sends to Ola as `location` with a 50 km `radius` to favour that city. Search answers are cached
  by words and that cell. `GEO_RATE_LIMIT` (30 a minute per person) covers typing at that pace.
- Scored by `workers/api/scripts/geo-precision.mjs` (by hand, with the key) on 15 Bengaluru places: before, our
  point was a median 419 m (at most 635 m) from Ola's and the area was in Ola's own line for 11 of 15; after, 0 m
  for all 15 and 14 of 15.
