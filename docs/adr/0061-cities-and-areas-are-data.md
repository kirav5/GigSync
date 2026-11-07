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
4. **Prices by city.** Every job record carries its city (migration 0020; all earlier records are Bengaluru's), taken
   from the live city whose circle holds the worker's card. An estimate reads only its city's jobs, by area then city,
   with the city's rate card where it has one and the state's legal minimum only where it is known. A city with
   neither jobs nor a card gets no estimate, and learns from its own jobs as they are agreed. Find asks for the city of
   the household's chosen address.

## Consequences

- Adding Kanpur is one admin call. Its households get no estimate until ten agreed jobs pass the 10/10/10 rule, unless
  a rate card for Uttar Pradesh is added. Its areas are not yet offered as Find's chips, and the worker's card and
  Talk's market answers still ask for Bengaluru's prices: those follow.
- City guides and moving advice stay Bengaluru-only: they are written content, not data.
