# ADR 0065: A reader on every phone, taught by GigSync's model

Date: 2026-11-10. Status: accepted by the founders. Amends [ADR 0052](0052-gigsync-model-on-a-mac-studio.md) (GigSync's
model reads every message in Find) and [ADR 0056](0056-one-reader-for-every-message-in-find.md) (one model call reads
each message); builds on [ADR 0042](0042-meaning-router-small-embedding-model.md) (a small encoder runs on every phone)
and keeps [ADR 0064](0064-the-model-decides-what-work-it-is.md) (a model's reading decides the work; word lists never
guess it).

## Context

Find understands a household through GigSync's model on the Mac Studio (ADR 0052): `read_turn` reads each message,
`route` checks every later message for a market question, and `same_work`, `scope`, `price` and `first_question`
follow. A first message can wait on up to six calls in a row. With the Studio unreachable, signed out or offline, Find
makes no guess and shows the list (ADR 0064 §3). The founders want the reading on the phone, including phones with
4 GB of memory, which are most of the pilot's.

What is measured ([model-comparison.md](../gigsync/model-comparison.md)):

| Reader on the phone               | Intent right | Download | Runs on a 4 GB phone |
| --------------------------------- | ------------ | -------- | -------------------- |
| Qwen3.5-0.8B, prompted            | 31%          | 440 MB   | barely, slowly       |
| Embedding router, then word lists | 62%          | 129 MB   | yes, on the CPU      |
| Qwen3.5-2B, prompted              | 71%          | 1,050 MB | no: needs 8 GB       |

A small language model, prompted, is worse than the embedding router, and most of its time goes to reading a
prompt of about 1,000 tokens. The prompt is long because the task lives in it: the rules, the examples, the list.

Most of what Find asks of the model is not writing. Which kind of message is this, which work, which words say where,
when, what and for how long: that is choosing and marking words, which an encoder does in one pass. The questions
that follow can be written once per kind of work, as the trades' already are (ADR 0058).

## Decision

1. **A reader on the phone marks what a message says.** Given a message and the question open, it returns the kind
   of message (`TurnKind`) and the spans of the message that are each of five details (`ReaderSlot`): the `kind` of
   work in the owner's words, `where`, `when`, `what` (the job's scope or what is wrong) and `how_long` (how the work
   is hired). It returns positions in the message, never words of its own, so it cannot invent an area or a number.
   The schema is `packages/protocol/src/reader.ts`.
2. **Code decides what the spans mean, as it does now.** `where` goes through the area lists, `when` through the time
   reader, `how_long` through the arrangement words, `kind` through the embedding model to the live list of trades,
   kinds and listed skills (ADR 0059), so a kind added tomorrow needs no new model. "Next month" can no longer make
   monthly work: the reader marks it `when`, and only words marked `how_long` are read as an arrangement.
3. **The questions are data, not writing.** Every kind of work gets its details in the order to ask them, its own
   wording for each, in en, hi and kn, a few phrasings each, and a line that repeats back what was understood. The
   interview asks the first detail still missing. This extends ADR 0058's fixed questions from the trades to every
   kind, and takes `first_question` and `price` off the model for the kinds outside the trades.
4. **The reader is a fine-tuned copy of the phone's embedding model** (`multilingual-e5-small`, about 118M
   parameters), with a head for the kind of message and a head that tags each token with its detail. It is exported
   to ONNX, quantized to 8 bits and run like the embedding model: Transformers.js in a worker, on the CPU, no WebGPU.
5. **GigSync's model teaches it, once per schema.** The 30B on the Mac Studio writes the training data: code draws a
   target (a kind, some details, the rest left out, a kind of message), the model writes a message in a random style
   that says exactly that, the model labels the message again without the target, and only messages where the two
   agree are kept. Training runs on a founder's machine. The test set is kept apart and is never written by the
   teacher: the English cases of `eval:intent` and `eval:find` and sentences the founders write.
6. **English first.** Hindi, Kannada, Hinglish and Kanglish follow with the same pipeline once English passes the
   gate; until then those messages go on to the readers below.
7. **The reader goes first in Find; the rest stay behind it.** A message the reader is sure of is read by it alone.
   Below its threshold, or with no reader on the phone: GigSync's model when it can be asked, then the embedding
   router, then the word lists, then the list to pick from (ADR 0064 §3). Lite mode turns the reader off like every
   other model.
8. **Nothing a person types leaves the phone for the reader**, and its logs carry what it was for, how long it took
   and how sure it was, never the words.

### The gate

The reader ships only when, on the held-out English test set and on a real Android phone with 4 GB of memory:

| Measure                                           | Bar                                                  |
| ------------------------------------------------- | ---------------------------------------------------- |
| Right kind of work                                | within 5 points of GigSync's model; above 62% by far |
| Each detail (`where`, `when`, `what`, `how_long`) | reported per detail against GigSync's model          |
| `pnpm eval:find`, right job                       | no lower than with GigSync's model alone             |
| Time per message                                  | 95th percentile under 1 s                            |
| Download                                          | 150 MB or less                                       |

## Consequences

- Find on most phones reads a household without the Mac Studio, offline and signed out included.
- GigSync's model stops being in the path of every message and becomes the teacher (writing data and the question
  sets' first drafts), the fallback for messages the reader is unsure of, and the writer of what still needs writing:
  Talk's open chat. Talk's intents, the worker's card and the agents' answers can move to the same reader later, as
  more heads on the same model.
- Every change to the details, the kinds of message or a new language means writing data and training again. Kinds of
  work and wordings do not.
- The phone downloads a second model of about 120 MB, offered with the embedding model.
- A question no longer follows the owner's exact words for kinds outside the trades, as ADR 0058 already accepted for
  the trades.
- The repo gains its first Python, for training only, outside CI.

## Order of work

1. This ADR and the schema.
2. The question sets as data, used by the interview on every phone.
3. The data generator (`scripts/reader-data/`), run on the Mac Studio.
4. Training and export (`training/reader/`).
5. The gate: `eval:reader` and timing on a 4 GB phone.
6. The reader in the app, first in Find.

## Amendment (2026-11-11): shipped before the gate, the reader alone for what it reads

The founders decided to ship the first trained reader (`model-v3`: about 25,000 English messages, a third of them
problems that name no worker) before the gate's test set and phone timing exist, and with no fallback to GigSync's model
for messages it reads but is unsure of. Below its threshold the work goes to the matchers that read with no model (the
trades and listed skills by meaning, then the list to pick from), not to the model. Measured on `eval:find`, through the
app's own code path (`pnpm eval:find --reader phone`):

| Set              | GigSync's model alone | Reader, model reachable | Reader, no model |
| ---------------- | --------------------- | ----------------------- | ---------------- |
| English (25)     | 100%                  | 92%                     | 88%              |
| Pilot chats (10) | 100%                  | 90%                     | 90%              |
| Hinglish (25)    | 100%                  | 100%                    | 56% (word lists) |
| Kanglish (25)    | 88%                   | 88%                     | 80% (word lists) |

So the gate's first bar (within 5 points of GigSync's model) is not met in English, and the 4 GB phone's timing is
not measured; these conversations also tuned the model's prompt, which flatters it. The misses are named: work the
reader is unsure of (a tailor at 0.41), a worker's own wording for a kind ("Cooler fixing"), an aquarium read as a water
tank, and "pandit". The gate stays the bar for the next reader, and Hindi, Kannada, Hinglish and Kanglish wait for it.

What changes from the decision above:
- The reader reads only English: Hindi and Kannada by their script, and Hinglish and Kanglish by their everyday words
  in English letters (`readerReads` in `packages/core/src/reader/languages.ts`), go to GigSync's model as before.
- Told a question, the reader takes nearly any words for its answer; an answer that marks nothing of the detail asked
  for is read again with no question open, so other work said at "Where?" is still offered as a switch.
- The reader names the kind of work itself (a third head, `work`), so a kind added to GigSync needs a retrain, as
  the founders accepted on 2026-11-11.
- Its files are on GigSync's model host (an R2 bucket, `pnpm reader:publish`), at a folder per version set at build
  time by `VITE_READER_URL`; a build without it has no reader. It is fetched with the understanding pack, or alone by
  a phone that fetched the pack before.
