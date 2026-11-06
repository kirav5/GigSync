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
| Calls a chat         | How many model calls a chat costs, by prompt, and the most in any one chat        |

A conversation is what a person says first, what they answer the model's own questions with, the work they want, and
optionally other work they name part-way. Everything else has a fixed answer: chips are tapped, the day is tomorrow, the
budget is ₹2,500, and one address is saved in HSR Layout. There are 23 conversations in each of five sets: English,
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

## One reader for every message (ADR 0056)

The same 100 conversations, the same day, with `--reader turn`:

| Measure              | Baseline | One reader |
| -------------------- | -------- | ---------- |
| Right job            | 81%      | **96%**    |
| No repeats           | 95%      | **96%**    |
| No "Sorry"           | 97%      | **99%**    |
| Reached the readback | 66%      | 61%        |
| Questions a chat     | 2.3      | 2.4        |

Fewer chats reached the readback because the reader says work is outside the trades instead of forcing it into one, and
such a chat still ended there. The 10 conversations that name other work part-way were offered a switch 9 times; the
word lists offer none.

All 110, by set:

| Set      | Right job | No repeats | No "Sorry" | Reached the readback | Offered a switch |
| -------- | --------- | ---------- | ---------- | -------------------- | ---------------- |
| en       | 100%      | 91%        | 100%       | 64%                  | 2 of 2           |
| hi       | 100%      | 100%       | 100%       | 64%                  | 2 of 2           |
| kn       | 95%       | 100%       | 100%       | 68%                  | 2 of 2           |
| Hinglish | 95%       | 91%        | 95%        | 64%                  | 2 of 2           |
| Kanglish | 91%       | 100%       | 100%       | 64%                  | 1 of 2           |

471 model calls, median 1.3 s, slowest 3.2 s. The conversations were tuned against as the prompt was written, so these
are better than a fresh set would score.

## Finding listed work (ADR 0057)

With ten skills listed on the board, the conversations for work outside the trades want a listed skill, and one more
in each set wants work nobody lists, 115 in all. "Reached the readback" now also counts a chat for work nobody lists that
says so honestly.

| Set      | Right job | No repeats | No "Sorry" | Reached the readback | Questions |
| -------- | --------- | ---------- | ---------- | -------------------- | --------- |
| en       | 100%      | 96%        | 100%       | 100%                 | 1.7       |
| hi       | 100%      | 96%        | 100%       | 100%                 | 1.5       |
| kn       | 91%       | 100%       | 100%       | 100%                 | 1.7       |
| Hinglish | 96%       | 96%        | 96%        | 96%                  | 1.8       |
| Kanglish | 87%       | 96%        | 100%       | 91%                  | 1.8       |
| **All**  | **95%**   | **97%**    | **99%**    | **97%**              | **1.7**   |

36 of the 40 conversations wanting a listed skill found it, and no conversation was matched to a skill it did not want.
What it misses is the tailor and pest control in Kannada and in romanised Hindi and Kannada. A romanised sentence is what
the model reads worst, as ADR 0052 found.
