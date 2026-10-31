# ADR 0041: A price from the job's drivers, from GigSync's agreed jobs and community rate cards

Date: 2026-10-31. Status: accepted. Supersedes [ADR 0030](0030-rate-estimates-from-sourced-quotes.md) (web quotes)
and amends [ADR 0039](0039-market-prices-and-expiring-contacts.md) §1 (how a range is made).

## Context

The goal: whatever a household or worker types about a job in one of GigSync's trades, they get an idea of what it
should cost, from GigSync's own agreed prices when there are enough and from the city's community rate card until
then. "I want my 4BHK villa
painted" gets the questions that move the price (how many square feet, inside or outside, how many floors, who buys
the paint) and then a range with how sure it is, never a false exact figure.

Today a painter request knows only the bedroom bucket and who buys the paint; "villa", floors, inside or outside and
area are lost, and most published prices for painting are per square foot, which the code cannot use without an area. Job
records keep only the total price, so GigSync cannot learn its own per-unit rates.

Web quotes came from Claude's web search and fetch (ADR 0030): a frontier cloud model in the path of every new
estimate. A draft of this ADR replaced them with model estimates from Gemini on Vertex AI (and Claude or Workers AI)
behind pluggable providers; the founders removed both before release (§5).

## Decision

1. **Price drivers per trade, in protocol.** Each trade lists the facts that move its price, with units: painter
   (paintable area or area band, inside / outside / both, floors, house type, who buys the paint, finish), cook (people,
   meals, days a week), maid (rooms, frequency, tasks), driver (hours, days, vehicle), electrician, plumber, carpenter
   and AC (problem, number of points or units). A driver can be unknown; each has a default estimate and a spread.
2. **The phone's model decides what to ask; code guarantees the top driver.** (Amended 2026-10-31.) With a usable
   model on the phone (ADR 0040), the model decides the price questions for any job, up to `MAX_PRICE_QUESTIONS` (5),
   in the owner's language, one at a time, and may stop early (`done`). Each question is structured output (its text,
   the driver it fills or a short fact label, optional choices), checked by code (length, mark, language, no money,
   contacts or numbers the owner did not give); a malformed reply hands over to the fixed questions. Code guarantees
   one thing only: if the model never asks the job's most price-moving driver (ranked first when it began, e.g. the
   area for painting, meals for a cook), code asks it within the five. Without a usable model (lite mode), code asks
   the fixed drivers that widen the range most, while they are worth asking, also at most five. "I don't know" or
   skip ends the questions; the unknown drivers are assumed and the range says so. Free text is parsed on the phone.
   Answers that are not drivers become at most five short labelled facts, scrubbed of phone numbers and addresses,
   which stay on the phone for the owner's agent. A need outside the trades is recognised (by the phone's model) and
   answered plainly: GigSync has no prices for that work yet, and nobody offers it on GigSync. The estimate is
   requested once per job, after the questions end, carrying the structured drivers only.
3. **Code computes the figure, from two sources.** (Amended 2026-10-31: no cloud model in estimates.) A range is a
   per-unit rate (per sq ft, per month, per visit) times the quantity from the drivers, times adjustments (exterior,
   floors, finish), with unknown drivers widening it: each unknown is measured alone and the unknowns are combined in
   quadrature on a log scale, of which half is shown, as the range is the usual middle, not every possible job. Per-unit rates come from GigSync's agreed jobs (weighted by
   recency, leaning from city to area as the area's jobs grow, still at least 10 jobs between 10 workers and 10
   households before they count) blended with the city's **community rate card**, whose every entry names its
   provenance (source, issuer, date, URL or "to be confirmed": a state minimum wage notification, a union's
   recommended wages, or "GigSync seed, unverified"). The legal minimum is the floor. The answer carries a confidence
   label and what it rests on ("34 GigSync jobs + Bengaluru rate card: Karnataka minimum wages 2026"). No model
   produces a number, and no figure appears without its source.
4. **Job records carry quantities** (area band, inside/outside, floors, people, meals and so on, never words), so
   GigSync learns its own per-unit rates.
5. **No cloud model and no web search produces a price.** (Founders, 2026-10-31.) Nothing in GigSync calls a cloud
   model ([ADR 0010](0010-no-cloud-model-in-gigsync.md)), estimates included: no model estimates, no web quotes, no
   relay, no scheduled model job. Why: Mozilla's Human-Scale AI call, which GigSync is applying to, excludes projects
   whose core depends on frontier models, and an estimate is core (every card and every budget asks for one). And the
   one search that could have fed a shared rate, Gemini's Grounding with Google Search, is closed to this use: Google's
   terms (Gemini API terms; Google Cloud Service Specific Terms §20(k)) forbid caching, analysing or learning from
   grounded results, showing them to anyone but the user who asked, and building a database from them, which is what a
   shared rate is. The phone's own model may still choose the questions (§2); it never writes a figure.
6. **Two sources, each with its provenance.** A range rests on GigSync's agreed jobs (once they pass the 10/10/10
   rule) and the city's community rate card, blended as §3 says, and on nothing else. The rule for provenance: every
   figure shown says what it rests on ("34 GigSync jobs + Bengaluru rate card: Karnataka minimum wages 2026"), every
   rate card entry names its source, issuer, date and URL (or "to be confirmed", or "GigSync seed, unverified" until a
   union or a published notification replaces it), and a figure with no source is not shown. With neither source for
   a job, the answer is "no estimate" and the phone falls back to its shipped card, then the owner's own numbers. A
   request from an older phone, with scope buckets and no drivers, has its buckets read as drivers and takes the same
   path. The tables only ADR 0030 used (`estimate_cache`, `shared_prices`, `price_share_counts`, migration 0004) are no
   longer read or written; a later migration drops them.

## Consequences

- Big or unusual jobs get wide, honest ranges; everyday jobs (cook, maid, driver) get tight ones from the rate card's
  sourced figures and, as they accumulate, GigSync's jobs. The worker's visit still sets a painting price; the range
  guides the offer.
- Until GigSync has jobs in a trade, its range is only as good as the rate card, and most painting and repair figures
  are a GigSync seed, unverified: those ranges say so and carry a low confidence label until a union or a published
  source replaces them.
- No model key, relay or cloud bill sits in the estimate path, and nothing a person typed leaves the phone for one.
- Defaults and adjustments (e.g. how much exterior adds) start as stated assumptions and are replaced by GigSync's own
  rates as jobs accumulate; a back-test on held-out agreed jobs measures how often a range holds the real price.
