# ADR 0026: The Passbook lists only jobs both sides signed on GigSync

Date: 2026-10-29. Status: accepted. **Conflicts** with ADR 0018 §3 (platform-shift receipts the worker logs) and
narrows the day count of ADR 0019 (eligibility counter), both proposed on the research branch; see Consequences.

## Context

The worker's money screens mixed three things: jobs agreed agent to agent, jobs the worker typed in by hand
([ADR 0024](0024-no-manual-job-recording.md)) and a free "get paid" form. A welfare board, a union or a lender reading
the record could not tell evidence from self-report.

## Decision

1. **A Passbook tab** (`screens/Passbook.tsx`) built by `passbook(jobs, payments, me, now, offsetMinutes)` in
   `packages/core/src/payments/passbook.ts`:
   - only jobs where this phone is the provider and both sides signed the same terms;
   - only payments where `payee === me`;
   - each row: date, customer, trade, amount, method, status and the UPI reference when there is one;
   - rows newest first, and the line `passbook.about`: every entry is a job you and the customer both signed.
2. **Totals:** received this week (Monday to Sunday) and this month (calendar month), both by `confirmed_at` in the
   phone's local time; waiting (requested or paid); not asked yet (delivered or closed jobs with no payment, at the
   signed price). A disputed payment counts in none of them; a finished job whose only payments were disputed counts as
   not asked yet.
3. **Asking again** (`askAgain`) is offered only after a dispute, or for monthly trades (cook, maid) when nothing is
   open and the last confirmed payment is at least 28 days old (`MONTHLY_REPEAT_DAYS`). A one-off job that has been
   paid never offers it.
4. **Nothing is deleted.** Old hand-typed entries stay on the phone and drop out through the filter.

## Why

- Entries signed by both sides are evidence; entries one side typed alone are not, and mixing them devalues both.
- Totals a worker can say out loud ("this week, this month, still waiting") match how the pilot workers already talk
  about money.

## Consequences

- **Near-empty for months** for workers whose income comes from households already known to them, until the direct
  QR and the web signer (G2) bring those households in. This weakens the "worker-held record for a welfare board"
  pitch the Mozilla application leans on (decision (a) of the rework).
- **Conflict with ADR 0018 §3.** That ADR proposes unilateral `platform_shift` receipts, marked as self-logged,
  counting toward eligibility. This ADR keeps unilateral entries out of the Passbook. If platform-shift receipts are
  built, they belong in a separate, clearly marked section, never in these totals.
- **Narrower day count for ADR 0019.** Its counter counts calendar days with a receipt across all work. Counting only
  GigSync-signed days undercounts a worker's real days until outside work can enter signed.
- **The 28-day rule is a heuristic.** A household that pays on a different date each month will see the ask button a
  few days late (decision (h)); revisit with pilot data. ADR 0022's payment schedules would replace it with the
  signed schedule.

## Addendum (2026-10-29): the worker's record, and no eligibility wording

- Passbook now also lists **Work done**: every finished job both sides signed, grouped by month, each with its payment
  state, and **Paid to helpers** for jobs the worker hired (ADR 0029). Built by `workRecord()` in
  `packages/core/src/payments/record.ts`. The newest live payment decides a job's chip, so monthly work asked again
  shows as waiting.
- Because the record holds only GigSync-signed work, it **never shows day counts or welfare eligibility** ("days from
  eligible"). Until outside work can enter signed (or ADR 0018 §3 and ADR 0019 are decided), such a figure would
  undercount a worker's real days and could put them off registering.
