# ADR 0011: Pilot payments are UPI QR codes to the worker's own UPI ID, with no gateway

Date: 2026-10-25. Status: accepted.

## Context

A job between a gig worker and a consumer should end with the worker being paid, and the payment recorded against
that job. For the pilot, the payment path must be free. GigSync is Collab for one pair of people, so there is no
employer or platform in the middle that could collect and pass on the money.

## Decision

1. **The worker is paid straight into her own UPI account.**
   - Her app builds a standard UPI link (`upi://pay?pa=<her UPI ID>&pn=<name>&am=<amount>&cu=INR&tn=<note>&tr=<ref>`)
     and draws it as a QR code on her phone.
   - The consumer pays by scanning it with any UPI app.
   - On Android the same link can open a UPI app directly.
2. **Remote payment requests travel sealed.** When the consumer is not with her, the request is a sealed
   `payment_request` envelope, and the consumer's GigSync app renders the same QR or link.
3. **Every payment is recorded against the job's engagement id.**
   - Each record holds the amount in paise, the method (`upi` or `cash`), an optional 12-digit UPI reference number
     and a status: `requested → paid → confirmed`, or `disputed`.
   - Only the worker can confirm or dispute a payment.
   - If the consumer uses GigSync, their agent sends a `payment_record`, and she countersigns it.
4. **GigSync never holds, moves or sees the money**, and runs no payment gateway in the pilot.
5. **The worker's UPI ID lives only in her settings on her phone.** It leaves the phone only inside a QR code she
   shows, or sealed in a payment request to her consumer.

## Why

- **Free:** a UPI payment from one person to another has no fee. There is no gateway, no merchant account and no
  business KYC.
- **Outside payment-aggregator rules:** RBI's payment-aggregator rules apply to whoever handles the funds, and
  GigSync never does. Confirm this with counsel before the pilot.
- **Works without GigSync on the other side:** a consumer who doesn't have GigSync can still pay.
- **Fits the thesis:** the worker holds the record. There is no platform balance that could be frozen or deducted.

## Consequences

- **No automatic proof of payment.** No gateway webhook confirms a payment.
  - Proof comes from her confirmation, the consumer's record when they use GigSync, and the UPI reference number,
    which either side can match against a bank statement.
  - A later option, on Android only and with her consent, is to read the bank's "credited" SMS on the phone to fill
    in the confirmation.
- **UPI apps may block pre-filled links.** Some apps restrict links with a pre-filled amount that pay a personal UPI
  ID. Scanning a QR code is the main path; test the pilot's real apps in week 1.
- **No escrow, refunds or payouts.** Adding them later needs a gateway behind the same `Payment` records, with a
  business entity and per-payment fees.
