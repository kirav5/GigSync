# ADR 0062: A rate for each kind of work

Date: 2026-11-08. Status: accepted. Builds on [ADR 0046](0046-work-arrangements-hourly-to-monthly.md) and
[ADR 0061](0061-one-list-of-kinds-of-work-by-group.md).

## Context

A card had one usual rate and the phone one lowest, used for every kind of work on it. An electrician who also repairs
fridges was quoted ₹400 for both, and searches for fridge repair ranked and filtered them by their wiring rate. ADR 0061
made it easy to list several kinds, which made the gap common. The founders' rule since ADR 0061: price is per kind,
never per group.

## Decision

1. **The card's rate is for its first kind.** Any other kind may carry a usual rate of its own (`work_rates` on the
   card: a trade by value, a skill by its key). A kind without one is at the card's rate, as every card was.
2. **The lowest stays on the phone,** per kind (`WorkerRules.work_rates`). The interview asks only the usual rate for
   each; the lowest follows at the share the worker's own lowest is of their usual rate, as other arrangements' do
   (ADR 0046 §2). My card can set it apart.
3. **The interview asks once.** A card with more than one kind asks "Do you charge the same for all your work?"; only
   on a no does it ask each other kind's usual rate. Unclear answers settle on yes.
4. **The agent prices a request by its kind:** the kind's own plan when it has one, else the card's (and arrangements,
   which stay with the first kind).
5. **Search and the listed range read the kind's rate.** `worker_trades.rate_paise` and `worker_skills.rate_paise`
   (migration 0022, nullable); `COALESCE(own, card)` orders, filters and makes the range. In a search result the
   card's `rate_paise` is the rate for the work searched.

## Consequences

- The unit is still the card's (a visit, or an arrangement's). A tutor by the month and a mover by the move need a unit
  per kind; that is the next step if pilot cards show it.
- A card refilled on a new phone gets each kind's usual rate back with its lowest at the usual rate, and the agent
  shows every request first until the worker gives their lowest, as before.
- One more question in the interview, only for workers with more than one kind who price them apart.
