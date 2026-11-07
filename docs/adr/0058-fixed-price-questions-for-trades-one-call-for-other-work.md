# ADR 0058: Fixed price questions for the trades, one model call for other work

Date: 2026-11-07. Status: accepted. Amends [ADR 0041](0041-prices-from-drivers.md) §2 (the model chooses the price
questions).

## Context

The founders set on 2026-10-31 that the model chooses the price questions, one at a time. Find now reaches GigSync's
model on one Mac Studio ([ADR 0052](0052-gigsync-model-on-a-mac-studio.md)), and the founders asked on 2026-11-07 that it
is not called more than it must be. `pnpm eval:find`, counting calls for the first time, found 3.9 calls a chat, 9 at
most, and price questions at 67% of the model's time: 2.7 calls on a trade job, one for each question and one more to
turn the answers into facts.

The trades already have what those calls wrote. Their drivers are ranked by how much each moves the range, and the
fixed questions are written and translated. They were the fallback whenever the model failed.

## Decision

1. **A trade asks its fixed questions, with no model call.** Code picks the driver that widens the range most, while it
   is worth asking, at most `MAX_PRICE_QUESTIONS`, as lite mode always has.
2. **Work outside the trades takes one call.** It writes up to two questions, asked in turn. Code keeps each answer as a
   fact under the question's label, so no second call turns answers into facts.
3. **A question already asked is not asked again.** The driver the trade's first question covers is left out, even when
   the answer gave no value, and counts are read in words as well as digits ("four", "चार").

Checks on the model's questions stay: language, no money or personal questions, no number the owner did not say.

## Consequences

| On 115 conversations, the 30B | Before | After |
| ----------------------------- | ------ | ----- |
| Calls a chat                  | 3.9    | 2.1   |
| Most calls in a chat          | 9      | 6     |
| Model time a chat             | 4.5 s  | 1.3 s |
| Right job                     | 95%    | 95%   |
| Reached the end of the chat   | 97%    | 97%   |
| No repeats                    | 97%    | 100%  |
| Price questions a chat        | 1.7    | 0.9   |
- Questions no longer follow the owner's words on a trade job: "my AC is not cooling" gets the AC's fixed questions.
- Fewer questions mean wider ranges where a driver stays unknown. The eval does not measure how good a range is.
- Facts are the owner's answers as they said them, under a label, not a model's summary of them.
- The trades ask the same questions on every phone, so a phone with a model and one without no longer differ.
