# ADR 0033: Negotiation draws hidden random settings per job; a model chooses tactics, negotiates terms and explains, while code keeps every price bound

Date: 2026-10-29. Status: accepted. Amends [ADR 0014](0014-agent-to-agent-jobs.md) (agent-to-agent jobs) and
[ADR 0030](0030-rate-estimates-from-sourced-quotes.md).

## Context

Each side's agent concedes from an opening toward a private limit on one fixed curve (`job/negotiate.ts`): the
household opens at exactly 70% of its budget, every side reaches its limit by its fourth offer, and accepts within 5%.
The formula is public, so the limits leak: the household's first offer reveals its budget (offer ÷ 0.7), and the
worker's first two offers reveal their floor (the second step is always 0.4375 × (opening − floor)). A side that knows
the rules can lowball and wait for the other's limit. Every job between the same limits also settles at the same
price, whatever the job or the people want.

The founders asked for the model to take on more of the negotiation (terms other than price, explaining offers,
reading a long description into a job scope) and for prices that cannot be guessed.

Letting a model choose the price, even within the limits, was considered and rejected: the other side's words enter
its prompt, so it can be argued or injected into conceding; it can leak the limit in words; its output is not
cryptographically unpredictable; the same job could settle differently by language or phrasing, which nobody can
audit; and phones without a model must still agree jobs.

## Decision

1. **Hidden random settings per job.** When a side's agent first plans a job, its phone draws, with the platform's
   cryptographic random source (`crypto.getRandomValues`), settings that never leave the phone and are stored with the
   job: the opening (household: a share of its budget in a named range; worker: a point between the band's typical
   and high, or their history), the concession curve's shape, the offer by which the limit is reached (3–5), a small
   jitter on each step, and the acceptance closeness (2–6%). Every offer is still clamped by code: never past the
   owner's limit, never below the legal minimum, at most `MAX_ROUNDS` offers.
2. **A model chooses a tactic, not a number.** From the owner's own instructions and the job (for example "I need it
   today", "no hurry, get me a good price"), a model picks one tactic from a fixed set (patient, steady, quick) that
   narrows the random ranges. With no model, or a reply that does not parse to one of the tactics, the tactic is
   steady. The model never sees a limit, a budget or an offer amount, and the other side's words never reach this
   prompt.
3. **Terms other than price are structured and negotiated by the model.** A job's terms gain fields (date and time
   window, who buys materials, coats, hours) validated by the protocol. Each owner's preferences come from their own
   words (grounded, confirmed on screen); the agents propose and counter terms, a model choosing among valid
   counter-proposals; code validates every proposal. Terms that change the price do so through code (the estimate's
   scope bucket, scope rules), never through a number the model writes. Both people see the final terms when they
   sign.
4. **Explanations are phrased by a model from facts built by code.** For each offer, code builds the facts (the other
   side's move, the usual rate and its sources, the owner's own limit) and a model phrases them in the owner's
   language. Every number in the model's text must match a fact exactly, or the template sentence is used instead.
   The owner's limit appears only in text shown to that owner.
5. **A model reads a long description into a job scope.** Each scope value it returns must appear in the owner's words;
   the owner confirms the chips before the estimate is requested.
6. **Tests that the limits no longer leak.** An attacker test simulates a counterpart that sees every offer and fits
   the best guess of the limit; it must miss by more than a named margin in most of thousands of simulated jobs, where
   today it guesses exactly. Property tests show no offer ever crosses a limit or the legal minimum. Injection tests
   show the other side's text never moves a tactic or a term out of bounds.

## Consequences

- Two jobs between the same limits settle at different prices; the result is still always between the two limits.
- Older phones keep the fixed curve until they update; mixing is safe because each side only ever reads offers.
- A tampered app can still lowball or walk away; it only ever reaches the other side's limit, never past it.
- Probing a worker's floor by opening many requests needs a server-side limit on repeat requests per household and
  worker; it is not part of this decision.
