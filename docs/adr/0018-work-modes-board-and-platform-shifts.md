# ADR 0018: Work in every mode: the board stays, terms gain a mode and the model-agreement fields, platform shifts enter the record, the ONDC relay and Bluesky-at-onboarding step aside

Date: 2026-10-27. Status: proposed. Amends [ADR 0014](https://github.com/kirav5/GigSync/pull/8) (board and terms),
[ADR 0006](0006-bluesky-connect-at-onboarding.md) (Bluesky at onboarding) and HLD v0.1 §12 (ONDC relay, G5).

## Context

The founders want the agent to find work "part time, full time or any other mode". The built G1 slice
([PR #8](https://github.com/kirav5/GigSync/pull/8)) models a job as one visit at one price; the LLD's richer
`JobTerms` (schedule, rate per hour/visit/month/piece, weekly off, leave, notice) was never built. Karnataka's
draft Domestic Workers Bill (15 Oct 2025, passage unconfirmed) would mandate a written agreement on a state model
format naming nature of work, daily hours, wages, leave and termination
([IndiaLaw](https://www.indialaw.in/blog/labour/karnataka-domestic-workers-bill-2025/)). Workers on platforms
have no record that survives leaving the platform, and the Central Rules' eligibility test counts days across
aggregators ([MediaNama](https://www.medianama.com/2026/05/223-social-security-central-rules-2026-gig-workers-90-days-work/)).
Ride-hailing already has worker-first apps bundling benefits (Namma Yatri, Yatri Sathi, Bharat Taxi), and the
job-board market is held by employer-paid marketplaces (Apna, Vahan).

## Decision

1. **The board stays, as discovery, not as a marketplace.** Search is by trade, distance, availability and mode.
   GigSync never ranks, never takes a cut, never shows a score. The board gains `mode` and availability on the
   card, and **postings** from unions and vouched partners (a placement, a training batch) alongside consumer
   requests. Apna-style liquidity is not a goal; the agent, not the board, does the matching.
2. **Terms gain a mode and the model-agreement fields.** `JobTerms` gains `mode: one_off | part_time | full_time |
   platform_shift`, `schedule` (days, hours, weekly off), `rate` (per hour, visit, month or piece), `leave_days`,
   `notice_days`, `start_date`, `end_date?`, `duties` (short list). The field names follow the Karnataka draft's
   model agreement so that a GigSync agreement is, by construction, the document the state will ask for. One-off
   jobs keep the built flow; the extra fields are optional there.
3. **Platform shifts are receipts the worker logs.** A `Receipt` of type `platform_shift` names the platform, the
   day, hours and earnings, with an in-app screenshot or statement kept on the phone. It is unilateral by nature,
   is marked so on export, and counts toward the eligibility counter (ADR 0019). Later, Android SMS consent
   (ADR 0012) and statement import can pre-fill it.
4. **Reviews are replaced by countersigned facts.** The `review` envelope and the `app.gigsync.review` record are
   removed. A closed job writes `worked_together` to both ledgers, countersigned; a board card may show "N
   countersigned jobs" as a count, never stars or text. This resolves the contradiction between the built review
   step and the non-goal "no ratings".
5. **The AT Protocol card becomes optional.** Onboarding is OTP, language, PIN, recovery code. A worker who wants
   a public identity can connect Bluesky from Settings; the board is the discovery path. ADR 0006's "combined
   sign-up" is no longer the default; its option 2 ("defer") is.
6. **The ONDC relay leaves the roadmap.** It returns only when a mobility or logistics partner asks for it; the
   platform-shift receipt covers delivery and ride workers' records meanwhile.

## Why

- Mode and the model-agreement fields are what make "find work in any mode" and "a record the state accepts"
  true, and they are schema work, not new infrastructure.
- Platform-shift receipts make the record cross-platform from day one without a single platform integration.
- Dropping stars removes a surveillance surface that domestic-worker unions have said they will read as such
  ([The Wire](https://m.thewire.in/article/labour/fear-sold-as-safety-domestic-workers-groups-slam-hiring-platforms-seek-regulation)).
- Bluesky at onboarding added an email and a CAPTCHA to a low-literacy flow for a profile the board already gives.

## Consequences

- Protocol: `job.ts` gains `WorkMode`, `Schedule`, `Rate`, the extra fields and `worked_together`; `BODY` loses
  `review`; `records.ts` loses `review`; `board.ts` gains `mode`, `availability`, `Posting`.
- Core: `negotiate.ts` must handle monthly and hourly rates (the concession curve runs on the rate's amount);
  `settle.ts` writes `worked_together` instead of `review`; `ledger` gains `platform_shift`.
- App: Jobs screen gains "Log a platform day"; Find gains mode and postings; the review screen goes.
- The e2e journey "search to a closed, paid, rated job" in `tests/ui` changes its last step.
- `workers/index` (Jetstream ingester) is retired; nothing on the board depends on Bluesky.
