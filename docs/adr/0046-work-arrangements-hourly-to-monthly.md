# ADR 0046: Maid and driver work by the hour, the visit, the week or the month

Date: 2026-11-02. Status: accepted. Amends [ADR 0041](0041-prices-from-drivers.md) §3 (a rate card entry per
arrangement; estimates in that arrangement's unit) and [ADR 0033](0033-unpredictable-negotiation-model-tactics-and-terms.md)
§3 (the arrangement is part of what both sides sign).

## Context

Every maid and driver estimate, card and deal assumed a monthly job: the rate card held a monthly figure, a worker's
card one monthly rate, and Find never asked how long the work was for. Snabbit sells house help by the hour; Urban
Company sells one-off cleans and monthly plans; families hire drivers by the hour, for one trip, some days a week or by
the month. A household wanting three hours on Saturday was shown ₹12,000–₹18,000 a month, and a worker who takes
hourly work had no way to say so.

## Decision

1. **An arrangement**, `Arrangement` in `packages/protocol/src/arrangement.ts`: `hourly`, `visit` (one-off),
   `weekly` (some days a week) or `monthly`, for the trades in `ARRANGEMENT_TRADES` (maid, driver). Each has its price
   unit: an hour, a visit, a week, a month (`week` is new in `PriceUnit`). Cooks stay monthly for now; adding them is
   one entry in that list plus rate card figures.
2. **Workers say which they take, and a rate for each.** The card interview asks, after the trade, which arrangements
   they take (several may be picked), then the usual rate for the main one (the longest: monthly, then weekly, visit,
   hourly) with its lowest rate as before, then the usual rate for each other one. Each other arrangement's lowest is
   kept at the same share of its rate as the main one's. The board card carries the arrangements and their usual rates
   (`BoardProfile.arrangements`, table `worker_arrangements`, migration 0012); the lowest rates stay on the phone. A
   card without arrangements is monthly only, as every card was.
3. **Households say what they need first.** Find asks, right after the trade (and its first question), "A few hours",
   "Just once", "Some days a week" or "Every month"; for some days a week the price questions then ask how many days.
   The estimate, the budget question and the readback are in that arrangement's unit.
4. **Estimates per arrangement.** Each city's rate card has an entry per arrangement for these trades; monthly keeps
   the existing figures. The per-hour, per-visit and per-week figures for Bengaluru are GigSync seeds, unverified, and
   say so, like every other seed (ADR 0041). Only the drivers that make sense for the arrangement move the price
   (`ARRANGEMENT_DRIVERS`): an hour of a maid's time is an hour whatever the flat; a visit is priced by rooms and tasks;
   a week by days, rooms and tasks. GigSync's own per-unit rates count only jobs of the same arrangement (a job record
   keeps it as `qty_arrangement`; records without one are monthly). The legal minimum floors monthly and hourly
   figures (the notified day rate per hour).
5. **Matching respects it.** A board search for maid or driver work sends the arrangement and finds only workers whose
   card offers it. The worker's agent declines a request for an arrangement its owner does not take, and plans and
   quotes from that arrangement's rate and lowest rate, never the monthly ones.
6. **The deal says it.** The arrangement travels in the request's details (`details.arrangement`), so it is in the
   offer's scope text that both phones sign and hash, and both apps show every price for such a job with its unit
   ("₹180 an hour"). It is not a new key in `Terms`: a phone below the terms protocol strips keys it does not know and
   would hash different terms, so the deal could never be signed.

## Consequences

- Older phones: a worker on an older build has no arrangements on their card, so a search for hourly or weekly work
  never finds them; a request reaching one directly (by QR) would be priced monthly by it, so the household's agent
  shows the unit with every offer and the household signs nothing it did not see.
- Hourly work agrees a rate per hour; how many hours is the existing `hours` term. A visit or a week is priced whole.
- The seeds are guesses until GigSync jobs of each arrangement pass the 10/10/10 rule. They need the same review with
  the union as the monthly card.
- Migration 0012 adds the table and the column. Neon is the live database: it runs only when the user approves the
  deploy, never from a development machine.
