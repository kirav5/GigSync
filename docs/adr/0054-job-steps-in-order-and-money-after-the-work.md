# ADR 0054: A job's steps in order, money after the work, and a reason to stop

Date: 2026-11-05. Status: accepted by the founders. Amends [ADR 0011](0011-upi-qr-payments-no-gateway.md) (when a worker
asks to be paid) and [ADR 0050](0050-hours-steps-addresses-and-maps.md) §5 (cancelling a signed job).

## Context

The worker's card already offered one step at a time (on my way, start work, mark done), but "Ask for payment" and "Paid in
cash" showed from the moment both signed, so a worker could be paid for work not done and a one-off job could read as
paid before it started. Cancel stayed the same plain tap until the work was marked done, so a job half done could vanish
with no word why.

## Decision

1. **Money follows the work.** On a one-off job the worker asks for the money, by UPI or as cash, only once the work is
   done. Work that recurs is still asked for by the period.
2. **One advance, before the work is done.** A worker may ask for part of the price, at most half
   (`ADVANCE_MAX_PERCENT`), once on a job. Trades that buy materials need it. It is paid by UPI or taken in cash like any
   request. It never settles a job: the progress line, the contact rules and the records all wait for the rest. Once
   the work is done the worker asks for what is left. A disputed advance counts for nothing, so the whole price is due.
3. **Stopping needs a reason.** Before the work starts, Cancel stays as it is. Once the worker has tapped Start work,
   either side's Cancel becomes "Stop this job", and each answer is the reason, which the other phone shows in its own
   language.
4. **Phones of different versions.** `PART_PAYMENTS_PROTOCOL` (10): an older phone keeps only a request for the whole
   signed price, so an advance is not offered to it, and the worker asks once the work is done. The stop reason is its
   own optional field on `Cancel` and not a `CancelReason`: an older phone refuses a reason it does not know, and would
   never see the job end. It drops the field and cancels.
5. **Where step times live.** On the phones only, as before: the server keeps agreed, done, cancelled and confirmed
   payments, and not when the worker set off or started.

## Consequences

- GigSync never holds money, so it cannot return an advance on a job that is cancelled or stopped. The two sides settle
  that between them, and the contact rules keep their cards until the cap, because an advance is not paid up.
- A worker who stops part way has no way to ask for the part they did. The advance is their cover.
- A later start code from the household (OTP) would sit at Start work. It needs a path for a household that is not at
  home, and a code both phones can check offline.
