# ADR 0012: Detect UPI payments automatically on Android, without a gateway

Date: 2026-10-25. Status: proposed (plan; not built).

## Context

Under ADR 0011, a payment goes straight from the customer's UPI app to the worker's bank. GigSync is told nothing,
so today the worker taps **Received** by hand. We want the app to notice the payment for them, for free, and without anything
leaving their phone. Two sources exist on Android:
1. **The customer's UPI app result.** When an Android app opens a `upi://pay` link and waits for a result, the UPI app
   returns a `response` string. The NPCI UPI linking spec defines it, for example
   `txnId=…&responseCode=00&Status=SUCCESS&txnRef=pay_…&ApprovalRefNo=412345678901`. Only the app that opened the link
   receives it, so it exists only when the customer pays from their own GigSync app on Android.
2. **The worker's bank "credited" SMS.** Indian banks send an SMS for every UPI credit: amount, account mask and the 12-digit
   UPI reference.

Neither source is authenticated proof:
- The result comes from the customer's phone.
- An SMS can be imitated.
- Some apps return no result, or return `SUBMITTED`.

## Decision

GigSync collects these signals as **evidence** on the payment. They pre-fill the worker's confirmation, and the worker still decides.
A payment is `confirmed` only by their tap, or by a standing rule the worker switches on themselves (step 4 below).

### 1. Customer side: read the UPI app's result

- **A new Capacitor plugin, `plugins/gigsync-upi` (Kotlin):**
  - `pay({ uri })` opens the `upi://pay` link through Android's Activity Result API. An app chooser picks the
    customer's UPI app.
  - When the UPI app returns, the plugin hands back the raw `response` string.
  - iOS and the web return `unsupported`. iOS can open UPI apps but gets no result back, so the QR stays the path
    there.
- **Parsing:** `@gigsync/core` `payments/upiResponse.ts` reads `Status`, `txnId`, `txnRef`, `ApprovalRefNo` and
  `responseCode`.
  - Keys are matched case-insensitively and missing keys are allowed, because UPI apps differ.
  - Statuses map as follows: `SUCCESS` means paid, `SUBMITTED` means pending, and `FAILURE` or no result means not
    paid.
- **What the customer's app does next:**
  - `SUCCESS` with a 12-digit `ApprovalRefNo`: it records `paid` with that UTR and sends a sealed `payment_record` to the
    worker, with evidence `{ source: "customer_upi_app", status, utr, at }`.
  - Anything else: it tells the customer the payment did not go through. Nothing is sent.
- **Dependencies:** this needs the customer to use GigSync on Android, and `payment_request` / `payment_record` envelopes
  delivered through the mailbox (G1).

### 2. Worker side: match their bank's credit SMS, with their consent

- **Off by default.** Settings › Payments › "Detect payments from my bank SMS" explains what is read, what is kept and
  how to turn it off. Turning it on is recorded in their local consents.
- **Default mechanism: Google's SMS User Consent API.** It needs no SMS permission.
  - When the worker shows a QR, the plugin listens for up to 5 minutes.
  - When a matching SMS arrives, Android itself asks the worker: "Allow GigSync to read this message?"
  - The worker approves each message separately.
  - Limit: the API only hands over messages containing a 4–10 character code with a digit. Most credit SMS qualify
    through the account mask (for example `XX1234`); the pilot measures how many.
- **Fallback, only if the pilot shows User Consent misses too many: `READ_SMS`.** Play allows it only for listed
  uses, which include SMS-based money management, after a permissions declaration. It also lets us read the sender, so
  we can check DLT bank headers such as `AX-HDFCBK`, which User Consent cannot.
- **Parsing, on the phone, with no model:** `payments/creditSms.ts` extracts:
  - the amount (`Rs` / `INR` / `₹`, commas, paise);
  - credit words (`credited`, `received`, `deposited`) and debit words (`debited`, `sent`, `paid to`), rejecting debits;
  - the 12-digit UPI reference (`UPI Ref`, `Ref No`, `RRN`);
  - the time.
  - Hindi credit wording is added from pilot samples.
- **Privacy:**
  - The SMS text is parsed in memory and dropped.
  - Only `{ amount_paise, utr, at, sender? }` is kept, as evidence on the matched payment.
  - Raw SMS is never stored, logged (only through `pii()`), sent or shown to a model.

### 3. Matching (`payments/match.ts`, pure, with test vectors)

An SMS credit matches a payment only if all of these hold:
- the payment belongs to this phone's payee (the worker), with status `requested` or `paid`;
- the amount is exactly equal;
- the SMS arrived after the request was made and within 24 hours;
- no other open payment has the same amount in that window. If two do, the app asks the worker which one.

How strong the match is:
- **Strong:** the SMS UTR equals the customer's reported UTR.
- **Amount + time:** amount and time match, but there is no UTR to compare.
- A match never moves money and never confirms on its own unless step 4 allows it.

### 4. What the worker sees

- A strong or amount + time match turns the QR card into "₹450 received? Matched your bank SMS (ref …4901)", with
  **Received** focused.
- The worker can switch on a standing rule, "Confirm automatically when my bank SMS matches the customer's UPI reference".
  It applies to strong matches only, and the audit records which rule confirmed each payment.
- With no match after the watch window, the screen falls back to today's manual buttons.

## Data model

`Payment` gains `evidence: Evidence[]`:

```ts
Evidence = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("customer_upi_app"),
    status: z.enum(["success", "submitted", "failure"]),
    utr: Utr.optional(),
    at: ISO,
  }),
  z.object({
    source: z.literal("bank_sms"),
    amount_paise: Paise,
    utr: Utr.optional(),
    sender: z.string().max(16).optional(),
    at: ISO,
  }),
  z.object({
    source: z.literal("worker"),
    action: z.enum(["confirmed", "disputed"]),
    rule: z.string().optional(),
    at: ISO,
  }),
]);
```

The evidence travels in `payment_record` envelopes and in evidence packs, so a union or helpline sees how each
payment was confirmed.

## Plan

| Phase | Work                                                                                       | Depends on     |
| ----- | ------------------------------------------------------------------------------------------ | -------------- |
| A1    | Protocol `Evidence`. Core `upiResponse`, `creditSms`, `match`. Test vectors.               | —              |
| A2    | `plugins/gigsync-upi` Android: SMS User Consent watch. Settings consent. "Received?" card. | A1             |
| A3    | `plugins/gigsync-upi` Android: `pay()` with result. Customer flow. `payment_record` sent.  | A1, G1 mailbox |
| A4    | Pilot measurement and tuning: match rate, false matches (target 0), app result coverage.   | A2, A3, pilot  |
| A5    | Only if needed: `READ_SMS` with a Play declaration, DLT sender checks.                     | A4 results     |

Test vectors (`packages/protocol/vectors/`):
- `upi_response.json`: response strings from GPay, PhonePe, Paytm and BHIM, collected on test devices.
- `credit_sms.json`: synthetic messages in the formats of SBI, HDFC, ICICI, Axis, Kotak, PNB, Paytm Payments Bank and
  Airtel Payments Bank, including debits and look-alikes that must not match.
- Real samples are added only with the sender's consent and with numbers changed.

## Consequences

- **What it costs:** still free. No gateway, no merchant account, no server. Everything runs on the two phones.
- **Android only:** iPhone and the web keep the QR and manual confirmation.
- **Not tamper-proof:** a determined customer could fake a "paid" result or an SMS. The safeguards are:
  - only the worker can confirm;
  - an exact UTR match is required for auto-confirm;
  - the evidence is in their record either way.
- **What a gateway would add** (verified webhooks, refunds, escrow) remains a later option behind the same `Payment`
  record (ADR 0011).
