# ADR 0019: The agent helps the worker register (e-Shram, state board) and counts the days that unlock welfare

Date: 2026-10-27. Status: proposed. Extends ADR 0016 (landing) and the ledger (LLD §3.6).

## Context

Registration is the gate to every statutory benefit, and nine in ten gig workers have not passed it:
[31.89 crore people are on e-Shram but only about 11.5 lakh as platform workers](https://organiser.org/2026/08/29/377578/bharat/five-years-of-e-shram-31-89-crore-unorganised-workers-join-indias-digital-social-security-net/)
against 12 million gig workers (Economic Survey, Jan 2026). e-Shram is self-declared, Aadhaar-OTP, and gives a
UAN, ₹2 lakh PMSBY cover and a one-stop window to 15 schemes. The Social Security (Central) Rules 2026 make
benefits depend on **90 days with one aggregator or 120 days across aggregators in the previous financial year**,
any calendar day with income counting
([MediaNama](https://www.medianama.com/2026/05/223-social-security-central-rules-2026-gig-workers-90-days-work/)).
Karnataka's Board issues a UIN and a dashboard, collects a 1% fee, and runs a grievance portal whose intake is
name, address, mobile and a description, with a 14-working-day action-taken report
([South First](https://thesouthfirst.com/karnataka/karnataka-platform-based-gig-workers-act-2025-rules-notified-board-to-meet-at-least-once-every-three-months/);
[Chambers](https://chambers.com/articles/digitizing-justice-grievance-redressal-for-platform-based-gig-workers-in-karnataka)).
State entitlements do not travel across state lines, so a move triggers re-registration. The DPDP Act gives no
portability right, so nothing can be pulled from a platform: the record must be captured as work happens.

Unions already do this by hand: [TGPWU helped 62% of surveyed members register](https://tgpwu.org/wp-content/uploads/2024/04/TGPWU_ImpactEvaluationReport_2023_Digital-1.pdf).

## Decision

1. **The app never files on the worker's behalf.** It opens the registry by deep link (e-Shram portal or UMANG;
   the Karnataka Board portal; the IPGRS grievance form), shows the fields the worker will be asked for in their
   language beside it, and lets the worker type. Aadhaar OTP is the worker's, on the registry's page.
2. **What comes back is a first-class record.** `Registration { registry, id (UAN, UIN, card no.), registered_at,
   state, expires_at?, proof (photo of the card, on the phone) }` in the ledger, exportable in the welfare scope.
3. **The ledger keeps an eligibility counter.** For each financial year and each counterparty (an aggregator, or
   "households" for direct work), the set of calendar days with a receipt (`check_in`, `payment`, `platform_shift`).
   The counter reports `days_with(aggregator)`, `days_across()`, and the Central Rules test (`≥ 90` on one or
   `≥ 120` across) plus any state rule from the city pack. "You are 23 days from eligible" is a template sentence.
4. **A move re-runs registration.** When the landing journey enters a new state, the checklist adds that state's
   board (if the pack lists one) and the counter starts a state-scoped view.
5. **Board registration of an agreement is a reminder, not an action.** Where a state requires an agreement to
   be registered (Karnataka's draft Domestic Workers Bill: within 30 days), the ledger sets a reminder with the
   export in the portal's format; the worker files.
6. **The welfare export matches the receiver's intake.** `welfare` scope carries days worked, earnings, UAN and
   UIN; `ipgrs` scope carries name, address, mobile and a description plus the pack as an attachment; both are
   defined with the receiver during G2 (HLD open question 2).

## Why

- Registration is the highest-value single action in the landscape and costs the app almost nothing.
- Counting days is exactly what a worker-held, cross-platform ledger can do and a platform-held one cannot.
- Never filing for the worker keeps GigSync out of the registry's trust boundary and out of Aadhaar handling.

## Consequences

- Protocol: `registration.ts` (`Registry` enum: `eshram`, `ka_board`, `ts_board`, `rj_board`, `tn_board`, …;
  `Registration`), `EligibilityRule` in the city pack. Core: `ledger/eligibility.ts` with vectors
  (`vectors/eligibility.json`: FY boundaries, multi-aggregator days, unilateral receipts counted but marked).
- App: a **Register** screen in the landing journey and in Settings; the card photo stays in the encrypted store.
- Open: whether unilateral platform-shift receipts should count toward the displayed test (default: counted,
  shown with "self-logged" marker); whether the Board will accept the welfare export as supporting evidence.
