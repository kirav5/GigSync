# ADR 0061: Cities and areas are data

Date: 2026-11-07. Status: accepted.

## Context

GigSync served one city, and the code said so in about fifty places: `City` was an enum with one value, the served
circle and the pilot's five areas were constants, and the rate card was Bengaluru's. The founders want to add Kanpur
(Kalyanpur) and any city after it without a release, and to price a new city from its own jobs when it has no card.

## Decision

1. **Cities and areas live in the directory** (`cities`, `city_areas`, migration 0019), each with names in English,
   Hindi and Kannada, a centre, and for a city a radius and its state. Seeded with Bengaluru and its five areas, so
   nothing changes for anyone today.
2. **`GET /v1/cities`** serves the live ones; a phone reads them once per run. **`PUT /v1/admin/cities`**, behind the
   admin key, adds or changes a city and its areas. Taking one off sets `live = false`; nothing is deleted.
3. **"Not in your area yet" follows the directory.** Until the phone has the list, the city it shipped with stands in,
   so the check never blocks anyone.
4. **Prices, in the steps that follow:** job records carry their city, and an estimate tries the area's jobs, then the
   city's, then the city's rate card. A city with none of these gets no estimate and learns from its own jobs.

## Consequences

- Adding Kanpur is one admin call. Until the later steps land, Kanpur's addresses are served but its estimates still
  read Bengaluru's card, and its areas are not yet offered as Find's chips.
- City guides and moving advice stay Bengaluru-only: they are written content, not data.
