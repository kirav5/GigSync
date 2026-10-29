# ADR 0024: The app no longer records jobs by hand; every job in it is agreed agent to agent and signed by both

Date: 2026-10-29. Status: accepted. Closes the last "still open" item of [ADR 0014](0014-agent-to-agent-jobs.md)
("the app still records jobs by hand until they are wired to `GigDevice`").

## Context

The worker's app had a "Jobs agreed in person" screen, a "Get paid" screen and a "My record" screen. The worker typed
a customer's name and the work, then asked for money against that entry. It was a pilot stand-in until agents could
agree jobs in the app (`payments/store.ts`; on screen, "for the pilot you record them here"). Agent-to-agent agreement
now works end to end in the app (`tests/ui/test/two-users.spec.ts`, `tests/e2e`), so that reason has expired.

The reason that survives is real: most of a domestic worker's income comes from households that are not on GigSync,
and a union or welfare board wants all of it.

## Decision

1. **Removed:** the screens `Jobs`, `JobCard`, `Pay`, `GetPaid` and `Record`; the manual flow's store
   `apps/mobile/src/payments/store.ts`; `GigData` and the second payment book in `state.ts`; their tabs and strings.
2. **Kept in the protocol and on the phone:** nothing is deleted from storage. Entries the old screens wrote stay on
   the phone and simply drop out of every screen, because the Passbook lists only jobs signed by both sides
   ([ADR 0026](0026-passbook-jobs-signed-on-gigsync-only.md)).
3. **Money actions live in the job.** Ask for payment, show my QR, paid in cash, money received and not received sit
   inside each signed job on Today (`payments/WorkerPay.tsx`).
4. **The way in for households not on GigSync is the signed path, not a typed one.** The design's replacement is the
   worker's direct QR or link plus the web signer (G2): an existing household scans the worker's card and sends a
   request, so outside income enters the ledger signed by both sides. Until the web signer exists, a household that
   will not install the app has no way in; that is accepted for the pilot.

## Why

- A one-sided, self-typed entry is weak evidence, and the parallel manual screens were a large part of why the app
  read as confusing (eight menu entries for a worker, now four tabs).
- Two ways to record the same job meant two payment books that could disagree.

## Consequences

- **Lost writer of `Collection.contacts`.** The manual flow was the only code that saved contacts. The agent's
  "ask {name}" routing (`packages/core/src/agent.ts` reads `Collection.contacts`) now has no contacts in the app.
  Accepted; it returns when signed jobs feed contacts, or with the web signer.
- **The passbook is near-empty at first** for workers whose households are offline (decision (a) of the rework). This
  weakens the "worker-held record for a welfare board" pitch until G2.
- `Collection.engagements` is now written only by the agent's ask-contact expert (`experts.ts`), which needs a saved
  contact, so in practice nothing writes it; nothing in the app lists it either.
