# GigSync — Roadmap

> Status: **v1.0, 27 Oct 2026.** The plan for getting from today's repository to a pilot that delivers the
> [vision](VISION.md). Scope per milestone is in [HLD §12](HLD.md#12-milestones); schemas and routes in the
> [LLD](LLD.md). Dates assume two founders working on it with one Kotlin contributor from G1b and a Kannada
> content author from G3; see §6.

## 1. Where the project is on 27 Oct 2026

| Branch / PR                                                                  | Holds                                                                                                                                                                                             | State                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `main` (`90aa4a0`)                                                           | M0 foundation code; HLD/LLD v0.1; ADRs 0001–0012                                                                                                                                                  | G0                                                       |
| [PR #7](https://github.com/kirav5/GigSync/pull/7) `feat/neon-postgres`       | Directory on Neon Postgres via Hyperdrive; migrations; ADR 0013                                                                                                                                   | Open, tests green                                        |
| [PR #8](https://github.com/kirav5/GigSync/pull/8) `feat/agent-flow`          | Agent-to-agent jobs: crypto, board, negotiation, two signatures, contact release, UPI, signature checks, both sides' screens, e2e and UI tests; ADR 0014                                          | Open, stacked on #7, 126 unit + 19 e2e tests green       |
| [PR #5](https://github.com/kirav5/GigSync/pull/5) `docs/review-pii-diagrams` | Private data raw on the phone, checked at the edge (ADR numbered 0013); diagrams as SVG; Settings fixes; model chooser; a Chrome built-in model engine on the web that must be dropped (ADR 0010) | Open, docs + app; conflicts with #8 and with this branch |
| This branch                                                                  | VISION, HLD v0.2, LLD v0.3, ADRs 0016–0020, ADR 0007→0008 renumber, this roadmap, the landscape report                                                                                            | Open                                                     |

What is **not** anywhere yet: a hash-chained ledger, receipts, the encrypted store and Keystore keys, the
sanitizer and edge check in the agent's path, exports, union mode, voice, any landing, circle, partner or
registration code, a licence, a named union, Cloudflare and Neon production resources, counsel's view on UPI.

## 2. What v0.2 decides

1. The product is the whole journey (VISION §4), built **record first, then landing, then circles**, with
   partners for beds, credit and training ([ADR 0016](../adr/0016-landing-journey-and-partner-registry.md),
   [0017](../adr/0017-circles-union-run-peer-groups.md), [0019](../adr/0019-registration-helper-and-eligibility-counter.md)).
2. Work in every mode: `mode`, schedule, rate per hour/month/piece, leave, notice and the Karnataka
   model-agreement fields on the terms; platform shifts logged into the same record
   ([ADR 0018](../adr/0018-work-modes-board-and-platform-shifts.md)).
3. The board stays as discovery, never a ranked marketplace; no stars anywhere
   ([ADR 0020](../adr/0020-no-ratings-worked-together-receipts.md)).
4. The ONDC relay and the Bluesky-at-onboarding step leave the critical path (ADR 0018).
5. Pilot city Bengaluru, one union, Kannada added to the language set.

## 3. Merge order and the conflicts to resolve first

Do this before any new feature work, in this order:
1. **Merge PR #7** (Neon directory). Create the Hyperdrive binding and the `DATABASE_URL_UNPOOLED` secret so the
   deploy workflow stops skipping.
2. **Merge PR #8** (agent flow). It is the G1 slice; everything in v0.2 builds on its schemas.
3. **Rebase PR #5 on main** and resolve:
   - Renumber its ADR 0013 to **0015** (0013 is Neon, 0014 is agent flow) and update HLD/LLD references.
   - Its HLD/LLD edits were against v0.1; HLD v0.2 and LLD v0.3 already carry its principle 4 and the
     edge-check sections, so take v0.2/v0.3 and re-apply only its diagram images (rerun
     `node scripts/diagrams/gigsync.mjs` after updating the script for the new containers and flows).
   - Its app changes (`App.tsx`, `adapters/ports.ts`, `payments/store.ts`) overlap PR #8's; PR #8 wins on
     structure, PR #5 wins on Settings and the model chooser.
   - **Drop its Chrome built-in model engine** (`plugins/gigsync-llm/src/web.ts` Prompt API path): that model is
     Google's and is not an on-device model GigSync controls. The web build runs lite mode until the WebGPU engine
     lands in G3 (ADR 0010).
4. **Merge this branch** (docs). It renames `0007-sanitize…` to `0008-…` (two ADRs were numbered 0007 and the
   HLD cited an 0008 that did not exist).
5. Open the licence question (README still says "No license yet"): the Mozilla memo recommended an OSI licence;
   decide before the first external contributor or partner reads the code.

## 4. Phases

Each phase ends with a demo on a ₹10,000 Android phone and green CI. "Partner work" runs alongside the code and
is on the founders, not the codebase.

| Phase | When (2026–27)    | Code                                                                                                                                                                                                                                                                                                                                                                                                                       | Partner work                                                                                                                     | Exit test                                                                                                            |
| ----- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| G1a   | Nov 2026          | Merge #7, #8, #5; renumber ADRs; licence                                                                                                                                                                                                                                                                                                                                                                                   | First meeting with DWRU Bengaluru (alternative: TGPWU Hyderabad); decide the Mozilla application by 20 Nov                       | `pnpm test`, `test:e2e`, `test:ui` green on main; deploy workflow runs                                               |
| G1b   | Dec 2026–Jan 2027 | Ledger hash chain; receipts incl. `platform_shift` and `worked_together`; `gigsync-store` (SQLCipher, Keystore keys); terms gain `mode`, schedule, rate units, leave, notice and a payment schedule with stage receipts (ADR 0022); slot holds in the Mailbox DO so a worker cannot be double-booked (HLD §8); negotiation on every unit and on the schedule; Kannada templates; review step removed; "Log a platform day" | Union MoU drafted; counsel asked about person-to-person UPI; 5 workers try the app with the organiser                            | Two phones agree a monthly part-time job offline-first; ledger verifies; store survives reinstall with recovery code |
| G2    | Feb–Mar 2027      | Registration helper and eligibility counter; evidence packs and exports in Labourline, IPGRS and Board formats; union mode on the web: inbox, flags, members; "What my agent shared"; `DELETE /v1/account`; WhatsApp/SMS gateway and the web signer for households without the app (ADR 0021)                                                                                                                              | Define the export with India Labourline and one Karnataka IDRC; Board meeting on the welfare export; union signs the MoU         | Union files one real wage claim from a pack; 10 workers register on e-Shram through the app                          |
| G3    | Apr–May 2027      | Landing journey, Bengaluru city pack, partner registry and vouches, housing handover and partner receipt, documents checklist, cash plan; `gigsync-speech` device test (IndicConformer vs Sarvam Edge on a 4 GB phone); shared-phone mode                                                                                                                                                                                  | Housing partner agreement (Nia.one first ask; a union or trust hostel as fallback); pack co-authored with the union              | A newcomer plans a move offline, books a vouched bed, and lands with a UAN within 14 days                            |
| G4    | Jun–Jul 2027      | Circles: open/join/roster/fan-out/relay, landing request, mentor offer, 30-day grants, mentor receipts; notifier (FCM) and background responder; flag governance screens; postings on the board                                                                                                                                                                                                                            | Union opens the first two circles (north Karnataka × Bengaluru × domestic; Bihar/UP × Bengaluru × delivery); mentor rules agreed | 5 newcomers matched to mentors; no identifier leaves a post (data-flow test)                                         |
| G5    | Aug–Oct 2027      | **Pilot**: 50 service workers, 10 newcomers; hardening; OTP via a real SMS gateway; consumer KYC attestation if the union wants it                                                                                                                                                                                                                                                                                         | Weekly union review; measures in VISION §9 reported monthly                                                                      | Targets in VISION §9; a go/no-go on a second city                                                                    |
| G6    | Nov–Dec 2027      | Lender scope and income proof; skilling partner postings; second city pack and language set (Hyderabad, Telugu, or Delhi, Hindi/Bhojpuri); ONDC relay only if a mobility partner asks                                                                                                                                                                                                                                      | Lender pilot with one NBFC; second union                                                                                         | One lender accepts a GigSync income export                                                                           |

## 5. Measures

Pilot targets are in [VISION §9](VISION.md#9-how-we-will-know-it-works). Two leading measures from G1b on,
reported in aggregate only: **agreements both-signed per active worker per month**, and **share of receipts
countersigned within 48 h**. If the second stays under 50% for two months, the consumer side is not adopting
and the design must change before G3 (see risk 1).

## 6. People and effort

| Need                                           | When        | Who                                                                      |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| TypeScript across protocol, core, app, Workers | all         | The two founders                                                         |
| Kotlin: store plugin, UPI plugin, responder    | G1b–G4      | One contributor, part time                                               |
| Kannada and Hindi templates, pack content      | G1b–G3      | A content author who knows domestic work in Bengaluru; the union reviews |
| Union liaison                                  | G1a on      | One founder, weekly                                                      |
| Device testing on ₹10,000 phones               | every phase | Both founders; Firebase Test Lab for regression                          |
| Counsel (UPI, DPDP, partner terms)             | G1b, G3     | External, two consultations                                              |

Rough effort at two founders full time: G1b 6 weeks, G2 7 weeks, G3 8 weeks, G4 7 weeks, G5 12 weeks of pilot
with light engineering. The schedule in §4 assumes that; part-time halves it.

## 7. Risks

| Risk                                                                    | Signal                                   | Response                                                                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Households will not install an app to hire a domestic worker         | Countersign rate < 50%; consumers absent | Unilateral receipts remain valid evidence; the WhatsApp/SMS door and web signer (ADR 0021) are in G2 so a household never has to install anything |
| 2. No institution accepts a worker-held record                          | Labourline/IDRC/Board decline the export | Define the format with them first (G2); fall back to the union desk as the receiver and the union as the filer                                    |
| 3. No union signs                                                       | No MoU by end of G1b                     | Pilot with an NGO steward (Aajeevika-type) for circles and vouches; keep the record and landing features union-independent                        |
| 4. Indic speech does not run on a 4 GB phone                            | G3 device test fails                     | Ship tap-first with templates; voice on 6 GB phones only                                                                                          |
| 5. Housing partner terms are bad for the worker (commissions, deposits) | Partner wants per-job commission         | Vouch requires the union's sign-off on terms; GigSync takes no fee; drop the partner                                                              |
| 6. Circles become harassment or recruitment channels                    | Steward reports; flags on mentors        | Steward-approved mentors only; 30-day grants; close the circle                                                                                    |
| 7. Platform-shift receipts are dismissed as self-reported               | Receivers ignore them                    | Pair with statement import (ADR 0012-style SMS consent) in G6; mark unilateral always                                                             |
| 8. Karnataka's Domestic Workers Bill stalls                             | No passage by G3                         | Terms still follow the model format; nothing else depends on it                                                                                   |
| 9. The two founders run out of time or money before G5                  | Phase slips > 1 month                    | Cut G4 circles to one circle; cut G3 voice; keep record + registration + landing checklist                                                        |
| 10. Grant dependence (what killed Driver's Seat, Gigbox)                | One funder                               | Decide the revenue question in G2 (see §8); union membership fee share and partner fees are the candidates                                        |

## 8. Money

The revenue model is in [REVENUE.md](REVENUE.md): institution-paid outcomes (registration, filed grievances)
first, a flat partner handover fee and insurance through a licensed partner second, a household-paid
verification line to be tested in the pilot, and an optional per-outcome worker charge capped at 10% of
revenue. A grant of ₹50–90 lakh is the runway for year 1; year 2 break-even (~₹34–39 lakh) needs one
institutional buyer in Karnataka and 5,000–10,000 active workers. Nothing GigSync earns may depend on a worker
earning less, waiting more, being steered or being ranked.

## 9. Decisions the founders must make now

1. Union: DWRU Bengaluru or TGPWU Hyderabad, and who makes the first call.
2. Mozilla: Incubator application by 20 Nov 2026, Fellowship, or neither.
3. Licence.
4. Keep the consumer `review` removal (ADR 0020) even though PR #8 built it.
5. Consumer KYC in the pilot: union's call, but the founders must put it to them.
6. Whether GigSync ever takes a partner fee (default in this roadmap: no in the pilot; flat listing fee as the
   candidate afterwards).
