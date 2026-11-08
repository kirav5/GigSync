# ADR 0061: One list of kinds of work, by group

Date: 2026-11-08. Status: accepted. Builds on [ADR 0059](0059-kinds-of-work-behind-a-workers-own-words.md).

## Context

Households and workers saw two lists: the 8 trades as chips, and 54 kinds of work behind the words. In testing,
"iron my clothes" landed on Laundry and ironing, which nobody listed, while maids, who iron, were a trade apart. A
worker unsure what to list had no list to look at. After a kind was tapped, a fixed question met them, written for any
work of a trade. And a worker who said "I also do cat care" lost the TV repair already on their card.

The founders asked for categories only. Trades carry what categories do not: rate cards, legal minimum wages, past
GigSync jobs, fixed price questions, how the work is booked, and the tables records and search use. Folding them away
would have lost the estimates that work today.

## Decision

1. **One list on screen, in groups.** The 8 trades and the 54 kinds sit together in 11 groups (`GROUP_KINDS` in
   `packages/protocol`), each kind in exactly one. Nobody sees which are trades.
2. **Groups are for finding, never for pricing.** Each kind keeps its own price: a trade from its rate card and jobs, a
   kind outside the trades from what its workers nearby list. A babysitter and a pet carer share a group and nothing
   else.
3. **Workers:** after naming their work, the card interview offers the rest of its group to tick ("Do you also do any
   of these?"), and My card shows every kind by group. A kind ticked outside the trades goes on the card as a skill
   under its own name. "Also" adds to the card instead of replacing it.
4. **Households:** "Pick from a list" opens the groups, then every kind in one. When a kind nobody lists yet is asked
   for, the others in its group that have workers are offered: no maid needed to be mapped to laundry by hand.
5. **A tap is met by the model.** The first question after a kind is tapped is worded by the model for that work, one
   call, filling the same detail the fixed question fills, so a trade's estimate reads the answer as before. Without
   an answer in time, the fixed question is asked.
6. **A list a few minutes old is checked again** before Find says nobody lists a kind, and a worker's agent takes a
   request that names a kind only by its name, as an older app sends it.

## Consequences

- One more question in the card interview, which any answer moves past.
- One more model call when a household taps instead of typing.
- Group names need Hindi and Kannada review, with the kinds' names.
- A category becomes a priced kind like a trade only when it has enough agreed jobs for its own rate card, one at a time.
