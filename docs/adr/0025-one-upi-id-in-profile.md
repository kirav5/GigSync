# ADR 0025: One UPI ID, kept in Profile and read at the moment it is needed

Date: 2026-10-29. Status: accepted. Confirms [ADR 0011](0011-upi-qr-payments-no-gateway.md) §5 ("the worker's UPI
ID lives only in their settings on their phone") and LLD §2.4a, which the app had drifted from.

## Context

The app kept two copies of the worker's UPI ID: one on the card (`WorkerRules.vpa` and `payee_name`), used by
payment requests, and one in Settings, used by the in-person QR. They drifted apart. A bad UPI ID on the card was
dropped silently and the worker waited for money that could not arrive. Consumers also saw a payee form they never
needed.

## Decision

1. **One store, in core.** `packages/core/src/payments/payee.ts` owns `Collection.settings` / `"payee"`:
   `loadPayee`, `savePayee`, `PayeeError` (`vpa`, `name`, `name_long`) and `PayeeMissingError`. The record is checked
   with the zod `Payee` schema in `packages/protocol/src/payment.ts`, which reuses `PAYEE_NAME_MAX`.
2. **Read at send time.** `requestPayment` loads the payee first and throws `PayeeMissingError` before anything is
   saved or sent, so the button stays usable after the worker adds one. It also refuses a second request while one is
   open, and parses the body with `PaymentRequest` before sealing. The worker's QR comes from
   `GigDevice.myUpiLink(paymentId)`, which reads the same store.
3. **Removed:** the card's UPI field, `WorkerRules.vpa` and `payee_name`, the UPI banners on Today and Get paid, and
   the payee form for consumers. The only UPI field is Profile's "Get paid to" (`payments/PayeeForm.tsx`), workers
   only.
4. **When it is missing.** Inside a job, "Ask for payment" with no UPI ID shows `money.need_upi` and a
   `money.add_upi` button that opens Profile. Today shows a non-blocking nudge (`PayeeNudge`) once the worker has an
   agreed or ongoing job and no UPI ID.
5. **Migration.** On load, a worker account whose stored card still carries a valid legacy `vpa` copies it into the
   payee store (with the account name, cut to `PAYEE_NAME_MAX`) when no payee is saved, then drops `vpa` and
   `payee_name` from the saved account. If the copy fails, the account is left as it was, so the next start retries.
6. **Signing out forgets it.** `signOut` drops the payee (`forgetPayee`) before the account, because phones are
   shared: a worker who signs in after another must never have customers pay the one who left, nor see their UPI ID.
   The same worker signing in again types it once more.
7. **The other side cannot invent a payment.** A `payment_record` for a payment id this phone has never seen is taken
   only when this phone is the payer and the amount is the signed price; otherwise it is ignored and logged. A
   method change to cash is accepted only from the payee, together with `confirmed`.

## Why

- One copy cannot drift. Reading it when the request is made means a fixed UPI ID takes effect at once.
- The UPI ID is not part of the public card and never was meant to be; keeping it off `WorkerRules` keeps it off
  every code path that publishes the card.

## Consequences

- **The worker can find out mid-job.** Taken literally, a worker with no UPI ID learns it when asking for money with
  the customer standing there. The nudge after the first signed deal makes this rare; if it still bites in the pilot,
  the fallback is a one-field sheet in the job that writes the same record (decision (b) of the rework). That keeps
  one store but shows the field in two places.
- **Cash is always possible.** "Paid in cash" sits beside "Ask for payment", so a worker with no UPI ID can still
  record money received; it creates the payment at the signed price with method cash and confirms it on both phones.
- Test seeding: core's `test/phones.ts` and e2e's `world.ts` seed the payee through a `payee` option instead of
  card fields.
