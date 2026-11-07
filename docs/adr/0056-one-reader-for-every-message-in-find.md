# ADR 0056: One reader for every message in Find

Date: 2026-11-06. Status: accepted by the founders, who asked for the model to understand what a person says, ask what
it needs, and then price and find. Amends [ADR 0040](0040-on-phone-model-router.md) and
[ADR 0042](0042-meaning-router-small-embedding-model.md) (the word lists decided the trade in Find),
[ADR 0041](0041-prices-from-drivers.md) §2 (five price questions) and [ADR 0051](0051-questions-that-fit-the-job.md)
(the need reader was English only).

## Context

Tested on real chats, Find behaved like a form. The code decided what came next and heard only the answer to the
question it had asked; the model was called in narrow pieces, each knowing little. "my tv not working" at "Where?" got
"Sorry, I didn't catch that" as many times as it was said, and in Hindi and Kannada no need reader ran at all. The word
lists went before the model, so "रसोई का नल" (the kitchen tap) was a cook's job, because "kitchen" is a cook's word, and the
model was made to pick from eight trades, so a fridge was an AC technician's.

The reasons for these choices have changed: since ADR 0052 most phones have a large model behind them.

## Decision

1. **One reader.** `readTurn` (`interview/read-turn.ts`) reads a message with what the need knows so far, in every
   language, and says what kind of message it is, what work it names, or that the work is none of the trades. It
   replaces the need reader, the job-type reader and the intent route for Find's first message.
2. **Its trade goes before the word lists.** The lists stay as what reads a message when no model answers.
3. **It reads later messages too**, when the lists cannot use them or when the question takes any words. It never reads a
   secret answer: the budget is not sent.
4. **Other work named part-way is offered, never guessed at.** "Do you want to ask about TV repair instead?" On a yes the
   new work opens in its own chat, and this one stays in the list (`need-switch.ts`).
5. **Three price questions at most**, not five, in plain words. The model is told the owner's words and what was already
   asked, including the fixed first question, and a repeat in other words ends the questions.

Unchanged: models propose and code decides. Code still holds what must be known before a search (the work, the address,
the day, the budget), and no price comes from a model. The fixed price questions stay as what lite mode asks. The price
question and the scope chips keep their own prompts: they are asked at a different moment, or checked differently.

## Consequences

Measured on 100 conversations against the 30B (`docs/gigsync/find-eval.md`): right job 81% to 96%, no repeats 95% to 96%,
no "Sorry" 97% to 99%, at 2.4 questions a chat against 2.3.
- A message that is not understood costs one more model call, about 1.3 s, and every typed answer to a free question
  does. That is more load on the one Mac Studio; the load test ADR 0052 asks for is still to run.
- Lite mode is unchanged, so a phone with no model is still the fixed flow.
- A person who says a trade outright can be overruled by the model. It did not happen in the eval, but the word lists no
  longer catch it.
- Model-written Hindi and Kannada questions have had no native-speaker review, and Kanglish is the weakest set.
