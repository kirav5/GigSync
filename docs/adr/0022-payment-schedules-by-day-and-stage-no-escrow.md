# ADR 0022: Payment by the day or by the stage, countersigned, with no escrow

Date: 2026-10-28. Status: proposed. Extends ADR 0011 (UPI, no gateway), ADR 0012 (auto-detect) and ADR 0018
(work modes). Research in `research_notes/GigSync WhatsApp and milestone payments/milestone_payments.md`.

## Context

A four-day painting job, a week of carpentry or a month of cooking is not "one visit, one price", which is all
the built flow (ADR 0014) models. Organised Indian players converge on the same shape: a small advance, one
mid-stage payment at a physically visible checkpoint, and the balance after inspection. Urban Company's painting
service takes 35% upfront and 65% after a joint final inspection
([Urban Company](https://www.urbancompany.com/mumbai-painting-vc)); Livspace and HomeLane pay interiors in stages
tied to carcass or production checkpoints ([Livspace](https://www.livspace.com/in/interiors/service/service-payments);
[HomeLane](https://homelane.com/homelane-terms-conditions)). The Code on Wages, in force since 21 November
2025, sets the default for daily-rated work as payment at the end of the shift, weekly by the last working day,
monthly by the 7th ([Corrida Legal](https://corridalegal.com/the-code-on-wages-2019-executive-summary-and-bare-act/),
secondary; whether a household is an employer under the Code is unsettled). Upwork and Airtasker protect both
sides with escrow and a 14-day auto-release; GigSync holds no money, so it needs the protection without the
escrow. Households fear advances because of advance fraud; workers fear non-payment after the work is done.

## Decision

1. **Every agreement carries a payment schedule, and the schedule is part of the signed terms.** `JobTerms`
   gains `schedule_of_payment: Stage[]`. A stage is `{ key, label, trigger, amount (share in basis points or
   paise), evidence, accept_within_hours }`. Triggers: `advance` (before work, against a materials list),
   `day_end` (each check-out), `checkpoint` (a named, photographable state such as "primer done"), `handover`
   (a walk-through), `timer` (accepted if the household stays silent for the window). Shares must sum to 100%.
2. **Defaults come from the city pack, per trade and mode; the agents negotiate them like the price.** For a
   multi-day painting job the default is: advance ≤ 35% only against a materials receipt, 30% at the primer
   checkpoint with a photo, 35% at handover after a walk-through, with 24 hours of silence counting as
   accepted. For day-rate trades (helper, mason, cleaner) the default is pay at each check-out, the law's own
   default. For monthly domestic work: by the 7th, with leave days from the terms. The worker's rules set a
   minimum advance share and a maximum gap between payments; the consumer's agent counters inside its budget.
3. **A stage is closed by a countersigned receipt, and the receipt asks for the money.** The worker's phone
   writes `stage_done` with the photo hash and sends it; the household accepts or disputes within the window;
   acceptance (or the timer) produces a `payment_request` whose UPI note and reference carry the stage key, so
   the bank's reference number ties the payment to the stage in both ledgers.
4. **A dispute pauses the schedule, not the record.** A disputed stage freezes later stages, keeps the work
   receipts, and builds the evidence pack for that stage: terms, the photo, the day receipts, the chat about it.
   The route is the union desk or India Labourline; for a household that signed through the web signer, the
   signed terms are the document a consumer forum or wage authority will ask for.
5. **Materials are separate from labour.** An advance for materials is recorded against a materials list and a
   photo of the shop receipt; it never counts as labour paid. The worker's rules may refuse to buy materials.
6. **No escrow, no holding, no mandate.** UPI's ₹1 lakh per-transaction limit splits large stages. Recurring
   debits to an individual's UPI ID are not relied on; daily collect requests are. GigSync never touches the
   money (ADR 0011).

## Why

- Small stages tied to visible checkpoints are what the organised market already does and what a household
  already accepts (35% is Urban Company's own advance).
- Daily settlement for day-rate work mirrors the law's default and ends the 15-to-30-day payout cycles workers
  complain about on platforms.
- The countersigned stage receipt gives both sides what escrow gives them, except the money itself: proof of
  what was agreed, done and accepted, in a form a helpline or forum will take.

## Consequences

- Protocol: `Stage`, `StageTrigger`, `schedule_of_payment` on `JobTerms`; receipt types `stage_done`,
  `stage_accepted`, `stage_disputed`, `materials`; `PaymentRequest.stage`. Negotiation counters on the schedule
  as well as the price (worker minimum advance, maximum payment gap).
- Core: `payments/schedule.ts` (validate shares, next stage due, timer acceptance), vectors
  `vectors/schedule.json` (painting 35/30/35, daily, monthly, split over ₹1 lakh).
- App: the confirm card shows the schedule as a plain list ("Day 1 ₹1,200 at the end of the day"); Today shows
  the next stage and what evidence it needs; Get paid asks for the stage.
- City packs gain `default_schedules` per trade and mode, reviewed by the union.
- Open: whether 24-hour silence should count as acceptance for households who signed via the web signer (pilot
  assumption); what a wage authority accepts from a `stage_done` the household never countersigned.
