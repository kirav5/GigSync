# ADR 0030: Rate estimates come from sourced quotes and opt-in GigSync prices; a model reads, code computes

Date: 2026-10-29. Status: superseded by [ADR 0041](0041-prices-from-drivers.md): no cloud model or web search
produces a price; estimates come only from GigSync's agreed jobs and community rate cards. Amended
[HLD](../gigsync/HLD.md) §2 (cloud models) and the rule in `packages/core/src/job/advice.ts` that "no model produces a
number". Extended [ADR 0014](0014-agent-to-agent-jobs.md).

## Context

The worker's agent plans a price from a city rate card (`job/city-rates.ts`): a researched seed with bands for two
trades (cook, maid), per month, with no notion of the job. A painter new to Bengaluru gets no range at all, and nobody
can say what "paint a 2BHK" usually costs. The household sees a band beside its budget question while the worker sees
none, so the side with less information is the worker.

The founders want both sides to start from an informed range for the job as described: from what the web says the
work costs, and, as GigSync grows, from what was actually agreed on GigSync. Their words: "the negotiation can happen
based on the ideal rates instead of the price set by either the user or the worker".

Three risks shape the decision:
- **Invented numbers.** A model asked for a range will produce one whether or not anything supports it. A worker
  cannot afford an invented price.
- **Skewed web prices.** Prices online are mostly agency and app listings: they include commission and assume
  materials or hours that informal work often does not.
- **Our own prices are sealed.** Agreed terms live only on the two phones (ADR 0014); the server never sees a price.

## Decision

1. **An estimate service on the server.** `POST /v1/estimates` takes `{ city, trade, scope }`, where scope is the
   structured details that change the price for that trade (rooms or area for painting and cleaning, people and meals
   for cooking, the problem kind for repairs, labour-only or with materials) and never the household's own words. It
   returns `{ low_paise, typical_paise, high_paise, unit, basis: { sources[], gigsync_jobs, legal_minimum_paise? },
   as_of }`, or "no estimate". Results are cached per (city, trade, scope bucket) for `ESTIMATE_TTL` (7 days), so a
   job type is searched once a week, not once per user.
2. **A model reads; code computes.** On a cache miss the server runs a web search for that job in that city and gives
   the pages to a model whose only task is to **extract quotes**: each price, the exact sentence it came from, the page
   URL, and what it covers (unit, area, materials, hours). Code then:
   - drops any quote whose sentence is not found in the fetched page, or whose number is not in that sentence;
   - normalises units to the request's unit and scope (per sqft × area, per day × days), dropping quotes it cannot
     normalise;
   - drops outliers (outside 1.5 × the interquartile range) and needs at least `MIN_QUOTES` (3) from at least two
     sites;
   - computes low, typical and high as the 25th, 50th and 75th percentiles.
     No number reaches a phone unless it is in a source sentence or computed by code from such numbers.
3. **GigSync's own prices, by consent.** After a job both sides signed, each owner is asked once per job: "Share this
   price anonymously to improve rate estimates?" Yes sends `{ trade, city, area key, scope bucket, price, month }`,
   with no user, names, contacts or exact date, to `POST /v1/estimates/prices`, stored without the sender's id. These
   prices are used for an estimate only once at least `K_MIN` (10) exist for that city, trade and scope bucket, and
   then are blended with the web quotes, weighted by count. Below `K_MIN` they stay unused, so no single price can be
   read back.
4. **The legal minimum is a floor.** Where a statutory minimum applies (`LEGAL_MINIMUM` in `city-rates.ts`), no part of
   an estimate is shown below it, and the estimate says so. Prices accepted under pressure cannot drag a range below
   the law.
5. **Suggestions, never mandates.** Both sides see the same estimate with its sources and date. It prefills the
   worker's opening price and least-I'll-take, and the household's budget, as suggestions the owner confirms or
   changes; the owner's own limit stays theirs and stays on the phone. The agents still negotiate with
   `negotiate.ts`. An offer far outside the estimate is flagged to its owner ("well below the usual rate") but not
   blocked.
6. **Off the core path.** A job can be agreed with no estimate: offline, on a cache miss that fails, or for a job type
   with too few quotes, the app falls back to the city rate card and then to the owner's own numbers, exactly as
   today. This keeps the HLD goal "works with no model at all". The HLD non-goal "any frontier or cloud LLM in the core
   path" is amended to: a cloud model may run on the server to read public pages for estimates, never on a user's
   data, never deciding a price, and never required to agree a job.

## Alternatives considered

- **Let the model decide the range from search results.** Simpler, but nothing stops an unsupported number, and a
  wrong range harms the worker most. Rejected.
- **Search on the phone.** Costs the user data, needs a model the phone does not have, and sends job details from every
  phone to a search engine. Rejected.
- **The static rate card only.** Checkable, but two trades, no notion of the job, and stale. Kept as the fallback.
- **Use every agreed price without consent.** Impossible without breaking the sealed-terms design, and wrong if it were
  possible. Rejected.

## Consequences

- New server secrets: a model API key and a search provider key (`wrangler secret put`), and a running cost bounded by
  the cache: roughly one search plus one extraction per job type per city per week.
- New protocol schemas (estimate request, response, shared price) and a migration (estimate cache, shared prices).
- `advice.ts` takes an estimate band when one exists, in place of the city band; scope rules then apply only where the
  estimate's scope did not already include that detail.
- Each estimate's sources are shown in the app, so a union can check them, and a steward can later sign a band that
  overrides the web for a trade.
- Open: which search provider and model; the scope buckets per trade; `K_MIN` and `ESTIMATE_TTL` after the pilot;
  whether showing platform-computed ranges raises any competition-law question (it suggests, never fixes, a price).
