# ADR 0029: A worker can hire another worker and suggest a colleague on a declined request; providers never send an address

Date: 2026-10-29. Status: accepted. Extends [ADR 0014](0014-agent-to-agent-jobs.md) (agent-to-agent jobs) and
[ADR 0028](0028-colleagues-linked-in-person.md).

## Context

An electrician needs a plumber, a painter a helper, a cook a stand-in. Roles in the protocol are per engagement, so a
worker's phone can already be the requester on one job and the provider on another; the app fixed the role at
sign-in. Separately, a worker who cannot take a request had no way to point the household to someone they trust.

## Decision

1. **Hiring.** Talk offers "Hire someone" (and recognises "I need a helper" in en, hi and kn, `hireIntent`). It opens
   Find for the worker; the first time, Find asks where the work is and saves it in Profile. The search never shows
   the worker's own card, and a phone cannot request its own owner. Hired jobs show on Today under "You hired" with
   the household-side actions, and in Passbook only under "Paid to helpers", never in earnings. A worker cannot ask
   money on a job they hired for.
2. **Providers never release an address.** The worker goes to the requester's place, so the contact card a phone
   releases as provider has no address. A worker's saved work site therefore reaches only the helper they hire, after
   both sign, and never a household they work for.
3. **Referrals.** After a request is declined by the worker or their agent, the worker may suggest a linked colleague.
   The household's phone receives `referral {colleague, card}` on that engagement (a side-channel kind) and offers
   "Ask {name}", which sends the same need as a fresh request to the colleague. Terms are never transferred: the
   colleague negotiates and signs anew. No referral fee in v1.
4. **Compatibility.** The device capability number sent at sign-in goes to 2 (`COLLEAGUE_PROTOCOL`): a phone sends
   `colleague`, `colleague_note` or `referral` only when every active device of the recipient reports ≥ 2. Older
   phones parse their inbox envelope by envelope and acknowledge one they cannot read, so a new kind never blocks
   their sync. **The API must be deployed with the new protocol before any phone ships it**, because the API rejects
   envelope kinds it does not know.

## Consequences

- No new protocol for hiring; `referral` is one new kind with `Referral` as its body.
- `requestPayment` and `recordCash` refuse a job where the phone is not the provider.
- The household's "people" names learn the colleague's name when it asks them.
