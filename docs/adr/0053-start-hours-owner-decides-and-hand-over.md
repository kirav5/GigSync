# ADR 0053: Start hours, the household decides a different time, three offers then the people, and a card at a glance

Date: 2026-11-05. Status: accepted by the founders. Decides [ADR 0049](0049-clock-slots-and-one-booking-per-slot.md)
(clock times, proposed) in a smaller form; amends [ADR 0033](0033-unpredictable-negotiation-model-tactics-and-terms.md)
§3 (who settles the `when` term), [ADR 0050](0050-hours-steps-addresses-and-maps.md) §1–3 (parts of the day) and the
round limit of the price negotiation.

## Context

In the pilot, with GigSync's model choosing counter-proposals (ADR 0052), a cook's agent and a household's agent
agreed ₹200 at once and then traded times for five rounds each: the household asked for 4 Nov afternoon, which the cook
had booked, and the cook's agent offered a different nearby time each round, so the rule that took a time offered twice
running never fired. Nobody could act while it went on; the time asked for had passed by the end; the worker's own
proposals were not shown. The founders also found the parts of the day (morning, afternoon, evening) too coarse for
people booking an hour, and My card's form too long to read.

## Decision

1. **A time is a day and a start hour.** The household picks a start hour (7 am to 8 pm, as Find's chips already
   offer) or any time; the worker's card says the days and the hours they work (from–to). Phones that understand hours
   (`HOURS_PROTOCOL`, 9) send `when.hour` with the day; the part of the day travels beside it for older phones, which keep
   agreeing parts of the day. Two times clash when their hours overlap, taking a job as two hours unless its own hours
   say otherwise.
2. **Never a time that has passed.** No agent proposes or accepts a day and hour before now. A job whose asked time has
   passed before it is agreed stops talking and goes to the household: pick a new time, or end it.
3. **The household decides a different time.** The worker's agent proposes the nearest times the worker is free; the
   household's agent never takes one itself. The job goes under **Awaiting you** for the household: "Ravi can come at
   5 pm instead", with Accept, Pick another time, or Decline. The other terms (materials, coats, hours) are settled by
   the agents as before (ADR 0033 §3), and a changed one is still signed by its owner.
4. **Five offers each, then the people.** Each agent makes at most five offers (`AGENT_OFFERS`). Without agreement, the
   job goes to both owners under **Awaiting you**, with the last offers. The owner whose turn it is may accept theirs,
   send offers of their own, or end the talk; the other may take the other side's latest offer while it stands, or end
   it. A side may make seven offers in all (`MAX_ROUNDS`), so each owner has two of their own; a phone below
   `OWNER_OFFERS_PROTOCOL` (8) refuses an offer past five, so to such a phone the owner may only accept or end. An
   older phone still walks away after its five. Offers an owner made themselves say so in the agents' conversation.
5. **Every tab has actions.** Awaiting you: the decision above. In talks: take over (accept their last offer, send an
   offer of your own) or end the talk. Agreed: the job's steps and cancel (ADR 0050 §4). Closed: ask the same worker
   again or find another, each in a new Find chat that asks the time and budget afresh.
6. **Each side's terms are shown.** The agents' conversation shows the terms with every offer, the owner's agent's
   as well as the other side's, starting with what the household asked for; a term that differs from the other side's
   last proposal is marked. The take-over card shows the terms of the offer it would accept.
7. **My card at a glance.** A worker's card shows their own work only (the trades and skills they chose), a rate for
   each arrangement they take (₹200 a visit, ₹9,000 a month), the days and hours they work, their area and a line about
   them; no estimate text. Every change is made by talking ("Change by talking" opens the chat), not a form.

## Consequences

- Two protocol bumps: `OWNER_OFFERS_PROTOCOL` (8) for the owners' own offers, then `HOURS_PROTOCOL` (9). Older phones
  keep parts of the day, and a job between an older and a newer phone agrees one.
- More jobs wait on people: a different time, a stuck price. That is the point: no talk goes on unseen.
- Migration 0015 adds the working hours (from, to) to `worker_profiles`; the board filters by the hour asked.
- A worker who cannot or will not talk to the chat has no form to fall back on; the chat must handle every card edit
  (trade, rates per arrangement, hours, area, about); the form goes only once the chat is shown to cover each.
