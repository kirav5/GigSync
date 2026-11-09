# ADR 0063: The worker's agent asks as the worker would

Date: 2026-11-08. Status: accepted. Builds on [ADR 0047](0047-open-skills.md) and
[ADR 0062](0062-a-rate-for-each-kind-of-work.md).

## Context

A household asked a worker for fridge repair, and the worker's agent asked them "About how long will it take?". Work
outside the eight trades never reached the model: it got a fixed list, "what exactly is the work" (already answered
by the request) and "how long", which is the worker's to judge, not the household's. For trades, the model saw only
the trade's name and the household's words: nothing about the worker it was asking for.

## Decision

1. **Never ask the household how long the work takes.** The fixed list for other work is only what the work is; a
   guard drops any model question about how long the job takes or how to do it (`worker_call`), in English, Hindi and
   Kannada.
2. **Every request goes to the model**, trades and other work alike, when the household's phones read written
   questions. The prompt names the kind asked for and says who the worker is: every kind on their card, their own line
   about their work, and what they said they need to know. All of it is quoted as data. The guards still decide, and
   the price still never comes from the model.
3. **The worker says what they need to know.** The card interview asks once, after "show me first": "Before you quote,
   what do you need to know from a customer?" Skippable. My card has the same list, one per line. It stays on the
   phone; the model words each for the job in hand and leaves out those that do not fit.
4. **Without a model,** the fixed questions are asked as before, less "how long".
5. **`pnpm eval:questions`** runs 22 requests across the groups through the real model and prints what it asked and
   what the guards dropped, for a person to judge.

## Consequences

- One more question in the card interview for every worker. It can be skipped, and it is what makes the agent ask
  what this worker needs rather than what any worker might.
- With a worker's list of one, the small model tends to ask only that one. Fewer questions for the household; watch
  whether workers find quotes under-informed.
- "A door" no longer reads as an address; "door number" still does.
- Not done: learning new questions from what workers ask by hand in the job notes after a quote. That needs notes
  linked to the job's kind and a prompt to the worker to keep one; next if pilot workers keep asking the same things.
