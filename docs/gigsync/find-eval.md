# Find conversation eval

`pnpm eval:find` runs every conversation in `vectors/find` through Find's real interview and a real model. The intent
eval scores one message; this scores the whole chat, on what went wrong in Find's first real tests.

| Measure              | What it catches                                                                   |
| -------------------- | --------------------------------------------------------------------------------- |
| Right job            | The trade wanted; for work outside the trades, a job named, no trade forced on it |
| No repeats           | The same question asked twice, in the same words or others                        |
| No "Sorry"           | "Sorry, I didn't catch that"                                                      |
| Reached the readback | The chat got as far as "Shall I look for someone?"                                |
| Offered a switch     | Other work named part-way was offered, not met with "Sorry"                       |

A conversation is what a person says first, what they answer the model's own questions with, the work they want, and
optionally other work they name part-way. Everything else has a fixed answer: chips are tapped, the day is tomorrow, the
budget is ₹2,500, and one address is saved in HSR Layout. There are 24 conversations in each of five sets: English,
Hindi, Kannada, Hinglish and Kanglish.

To run it against GigSync's model through its tunnel:

```bash
OLLAMA_URL=https://model.gigsync.network OLLAMA_MODEL=qwen3:30b-a3b-instruct-2507-q4_K_M \
MODEL_ACCESS_ID=… MODEL_ACCESS_SECRET=… pnpm eval:find
```

Limits: the conversations were written by a developer, not collected from households, and the Hindi, Kannada and
Kanglish ones have had no native-speaker review. A few dozen conversations measure the shape of a change, not a
percentage to the point. Each run gets whatever the model asks, so
two runs differ a little.

## Baseline

The 30B on the Mac Studio, 2026-11-06, the first 20 conversations of each set, after the bugs in the first tests were
fixed (`--reader lists`):

| Set      | Right job | No repeats | No "Sorry" | Reached the readback |
| -------- | --------- | ---------- | ---------- | -------------------- |
| en       | 85%       | 90%        | 100%       | 75%                  |
| hi       | 80%       | 95%        | 95%        | 65%                  |
| kn       | 75%       | 100%       | 95%        | 55%                  |
| Hinglish | 85%       | 95%        | 95%        | 65%                  |
| Kanglish | 80%       | 95%        | 100%       | 70%                  |
| **All**  | **81%**   | **95%**    | **97%**    | **66%**              |

349 model calls, median 1.3 s, slowest 3.3 s.

What is wrong in it: most chats that do not reach the readback are work outside the eight trades, which ends the chat.
The word lists take a Hindi or Kannada "kitchen tap" for a cook, and the need reader forces other work into the nearest
trade (a fridge is an AC technician's, cockroaches a maid's).
