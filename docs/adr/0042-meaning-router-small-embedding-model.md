# ADR 0042: A small embedding model on the phone reads what a message means; a language model only where one fits

Date: 2026-10-31. Status: accepted. Amends [ADR 0040](0040-on-phone-model-router.md) (the phone's language model
reads chat intent first) and [ADR 0041](0041-prices-from-drivers.md) §2 (how a need's trade is read); keeps
[ADR 0010](0010-no-cloud-model-in-gigsync.md) (nothing an owner types leaves the phone for a model).
Amended 2026-11-01: 301 more sayings, and the reader order measured ([Amendment](#amendment-2026-11-01-more-sayings-and-the-order-measured)).
Amended 2026-11-03: the language model reads first, asks when unsure, and is never switched off for speed ([Amendment](#amendment-2026-11-03-the-language-model-reads-first-asks-when-unsure-and-is-never-switched-off-for-speed)).

## Context

ADR 0040 put the phone's own language model in front of the word lists, and accepted that budget Android phones,
most of GigSync's workers, have no usable model and stay on the lists. Measured on 2026-10-31 (223 cases,
`vectors/intents`): the lists name the right intent 57% of the time, `qwen2.5:1.5b` 66%, and in Kannada the model is
worse than the lists. A 1.5B language model is about a gigabyte, needs a GPU or a strong CPU, and no phone engine
exists yet (`plugins/gigsync-llm` is a stub on Android and iPhone). Hand testing showed the cost of lists alone:
"i want to get my house cleaned" names no trade, because the maid list has "cleaning" and not "clean", and the need
interview falls back to eight chips.

Most of what GigSync asks a model to do is not writing: it is choosing from a short list. Which of thirteen chat
intents, which of eight trades, which of a dozen areas, which of three tactics, which numbered term. The founders'
position: no model on a server, and not no model either. That holds only if the model is small enough to reach the
phones people hold, over mobile data.

## Decision

1. **A sentence-embedding model, not a language model, reads closed-list meaning.** `multilingual-e5-small`
   (118M parameters, 8-bit ONNX, 129 MB with its tokenizer; 100 languages) turns a sentence into a unit vector. Core
   compares that vector with the vectors of labelled sayings and takes the label the nearest few carry
   (`packages/core/src/router/meaning.ts`). It runs through ONNX Runtime inside the app, in a browser's WASM or
   WebGPU and in a phone's webview, in about 3 ms per sentence on a laptop CPU. Nothing in it follows an instruction
   or writes text: the other side's words can land near a label, never change one, and there is no number in its
   output to check for a leak.
2. **One `Embedder` port in core** (`ports.ts`): `embed(text)` returns a unit vector or null. The app implements it
   with the understanding pack (`apps/mobile/src/adapters/embedder.ts`); tests with a bag-of-words fake. Like the
   `Model` port, null means "no model": every reader then uses the word lists, and lite mode turns both off.
3. **The pack is fetched once, on the owner's tap, and kept by the device.** Settings › Understanding pack shows the
   state (downloadable, downloading with a percentage, ready, failed) and the size. The browser's cache holds the
   weights; a later launch loads the pack only when that cache still holds every file of it, so it never fetches on
   its own. The same rule as ADR 0023's speech packs and the Chrome model download.
4. **Chat routing order becomes: meaning, then language model, then lists** (`router/route-chat.ts`). The meaning
   router (`router/meaning-route.ts`) names the intent; the word lists read the slots, as the lists always did; a
   route that lacks the slot its action needs is dropped and the readers after it answer. A message whose nearest
   saying is below `MIN_SIMILARITY` (0.8) is left to them too.
5. **The labelled sayings live in core and grow with misses.** The model prompt's examples (`router/examples.ts`,
   two or three per intent, kept short for a small language model) plus the index's own (`router/sayings.ts`, in
   English, Hindi, Kannada and Hinglish) make the index. A phrasing the pilot misses is added as a saying, never as a
   list word. The eval set (`vectors/intents`) is never copied into the sayings: it measures what they generalise to.
6. **The need interview hears a trade by meaning when the lists hear none** (`interview/trade-meaning.ts`,
   English sayings for now). A sentence must score at least `TRADE_MIN_SIMILARITY` (0.86) against a trade's sayings;
   below that it names no trade and the chips remain. The floor is set so small talk and work outside the trades,
   which scored up to 0.854 on the probe sentences, stay out.
7. **The kind of a repair job is read by meaning too**, and the clarifying question is asked once
   (`interview/problem-meaning.ts`). The problem driver's word lists ("door", "assembly", "repair") miss most answers
   ("one of the leg is broken"); the index places the answer among the trade's kinds, floor 0.85. Whether or not a kind
   was found, an answered or skipped clarifying question marks the driver settled, so the price questions never ask
   "What is the job?" after "What exactly isn't working?" was answered; the estimate assumes the kind and says so. The
   count question is worded per repair trade ("How many switches, sockets or fittings?") instead of one label for all four.
8. **Measured, in the same eval.** `pnpm eval:intent` runs the embedding model beside the lists and the language
   model, and reports each and the chain (`--no-meaning` skips it).

## Why

- The numbers, all on the 223 cases, nearest-neighbour with no training:

  | Reader                                                        | All | en  | hi  | kn  | Hinglish |
  | ------------------------------------------------------------- | --- | --- | --- | --- | -------- |
  | Word lists                                                    | 57% | 61% | 54% | 58% | 52%      |
  | `qwen2.5:1.5b` via Ollama (ADR 0040's run, 212 cases)         | 66% | 84% | 69% | 49% | 63%      |
  | Meaning, 40 sayings (the prompt's examples alone), then lists | 63% | 66% | 65% | 66% | 54%      |
  | Meaning alone, 150 sayings (this ADR)                         | 69% | 79% | 74% | 64% | 56%      |
  | Meaning then lists, 150 sayings (the shipped chain)           | 71% | 81% | 78% | 68% | 57%      |
  | Meaning, leave-one-out over the 223 cases as the sayings      | 77% | 77% | 89% | 87% | 56%      |

  The last row is the ceiling the same model reaches once it has heard as many sayings as the eval holds: accuracy
  follows the number of labelled sayings, which is cheap to grow, not the model's size. Kannada, where the language
  model lost to the lists, is where embeddings gain most at the ceiling. Hinglish is weak for every reader and needs
  sayings most. On the cases written to probe what the lists miss, the chain gets 61% against the lists' 26%.
- Trades: on twenty English need sentences none of whose words are in the lists, the lists named 5, the index 19,
  the one miss being a cleaning sentence more maid sayings now cover.
- Size and reach: 129 MB once against about a gigabyte, no GPU needed, offline after the first fetch. A ₹10,000
  phone can carry it; its webview runs the same ONNX file. ADR 0040's "budget phones stay on the lists" no longer
  has to be the outcome.
- Fit with the rules: an embedding model cannot be prompt-injected and never produces a figure, so ADR 0033's checks
  and ADR 0015's edge check have nothing new to guard. A language model stays where generation is needed: wording a
  question, explaining an offer, reading a long description into scope (ADR 0033, ADR 0041), on devices that can carry one.

## Consequences

- The chat gains an intent reader that works in every browser and webview with the pack fetched; the need interview
  stops saying "I didn't catch that" to "house cleaned". Lite mode is unchanged and complete.
- The similarity floor for intents barely separates right from wrong routings (right ones' median 0.89, wrong ones'
  0.885): it is a guard against nonsense, not a judge. Routing quality comes from sayings, and the "chat" catch-all
  regresses most (89% by lists, 51% by the chain) until it has more of them: a vague sentence lands near something
  specific. `helpOffer` and `guide` also lose a case or two each.
- The weights come from Hugging Face's CDN today, and ONNX Runtime's WASM from Transformers.js's default CDN. Before
  the pilot both move under `gigsync.network` so the app fetches runtime code and weights only from GigSync (H4), and the
  fetch is pinned by hash.
- Not measured yet: load time and memory on a 4 GB phone's webview (the ONNX session is about 150 MB resident), and
  Android's native path (ONNX Runtime Mobile with the same file) when the Kotlin plugin is written. The first eval on a
  test device is G1b work with the speech plugin's.
- A fine-tuned classifier head on the same embeddings would gain more at the cost of a training step; nearest
  neighbour needs none and is already ahead of both readers it joins.

## Amendment 2026-11-01: more sayings, and the order measured

Measured on the 1,452-case eval's 978 held-out test cases ([model-comparison.md](../gigsync/model-comparison.md)).
1. **301 more sayings** (`router/sayings-hinglish.ts`, `sayings-kanglish.ts`, `sayings-edges.ts`): Hinglish and
   Kanglish, which had two or three per intent and none, and the weakest intents in English, Hindi and Kannada, in
   pairs across the edges the index crossed (find taken for market, helpOffer for moving). None overlaps an eval case
   (word overlap under 0.6), checked by script. The examples the language model sees are tagged by script and shared.
2. **The order stays: meaning, then language model, then lists.** With Qwen3.5-2B (ADR 0040) as the language model,
   model first scores 69.8% and meaning first 67.3%; meaning first runs the model on only the 15% of messages it
   cannot place, which is what makes the 2B usable on a phone at all.

Consequences:
- The embedding router alone: 51% to 60%; then the lists, the reader on every phone without the 2B: 55% to 62%.
  Kanglish 35% to 57%, Hinglish 46% to 55%, English 71% to 77%, Hindi 59% to 63%; Kannada 63% to 58%, outnumbered by
  the new Latin-letter sayings: Kannada-script sayings are next.
- The similarity floor (0.8) almost never decides: e5's similarities sit between about 0.8 and 0.95. Routes are dropped
  for a missing slot instead. Neighbour counts from 1 to 7 score within a point; a softmax head on the same embeddings
  did not beat nearest neighbour (54% against 63% with the same training sayings).

## Amendment 2026-11-03: the language model reads first, asks when unsure, and is never switched off for speed

Decided by the founders after hand-testing on a phone with Qwen3.5-2B.
1. **Chat routing order becomes: language model, then meaning, then lists** (`router/route-chat.ts`), in Talk and in
   Find's first sentence. The embedding router answers only when the language model gives no route: none on this
   phone, no answer within `MODEL_ROUTE_TIMEOUT_MS`, or a reply core rejected. On a phone without the language model
   nothing changes.
2. **In Talk the model may ask instead of guessing** (`router/clarify.ts`). Where the chat allows it (`mayAsk`), the
   prompt says that a message that could mean two or three intents gets `{"intent":"clarify","options":[…]}`, and the
   reply's schema allows it. Core keeps only options this chat can act on, once each, at most three; with one left
   that is the route. The agent then asks in the owner's language, with one choice per intent and "Something else"
   (chat) last. The model only names the intents; the question and its choices are fixed strings in en/hi/kn, so
   nothing the model writes is shown as the question. A choice routes the words first written as that intent; words
   typed in reply that the model routes to one of the choices do the same. Find's chat never asks.
3. **The model reads the chat so far.** The routing prompt and the free reply's prompt get the last `RECENT_LINES` (6)
   lines of the chat, owner's and agent's, each cut to `RECENT_LINE_CHARS` (200), oldest first. They come from the
   phone's own chat and never leave it (ADR 0040, ADR 0010).
4. **The speed guard is removed.** Auto no longer turns the model off on a phone where 3 of the first 5 routing
   answers missed the time limit, and Settings no longer says so. While a note is being answered, Talk shows three
   pulsing dots and "Thinking…" (still under reduced motion). The per-message limit stays, so a message is never
   held longer than it.
5. **A note to keep is the whole message when no note was cut from it.** The meaning router took the note only from the
   word lists, so "I have a booking from 2-3PM tomorrow", which it placed as `remember` at 0.874, was dropped for a
   missing note; the model's route dropped a note that was not the owner's words the same way. Both now keep the
   owner's whole message.
6. **The free reply may not claim actions.** Its prompt now says the agent only talks and cannot book, arrange, send or
   agree to anything: on the same message the 2B had answered as if a booking were being arranged.

Why: the embedding router names an intent confidently even when it is wrong, and the similarity floor cannot catch it
(right and wrong routes score alike, above). The language model can say it is unsure and can read the chat so far;
the embedding router can do neither. Hand-testing found a worker's "save my booking for tomorrow 2-3PM" sent to
`find` at 0.876; Qwen3.5-2B named it `remember`, as it did the Hindi and Kanglish forms. The eval was not rerun for
this change; the 2026-11-01 numbers stand: model first 69.8%, meaning first 67.3% on the 978 test cases.

Consequences:
- On a phone with the 2B every chat message now waits for it: about 4 s per message on an M2 in WebLLM (round 2's
  prompt), slower on phones, against about 6 ms for the embedding router. Before, the model ran on about 15% of
  messages. The recent lines make the prompt longer still. Real-phone timing, open since ADR 0040, now decides how
  usable Talk is on the phones that carry the model.
- A phone that cannot answer within the limit sends every message through the limit's wait and then the embedding
  router, every time: nothing turns the model off for it any more.
- The model's first answer after the app opens includes loading it onto the GPU (7.5 s through Ollama on an M2), so
  the first message of a session often falls to the embedding router.
- An answer of `chat` from the model is final: the embedding router is not asked for a second opinion. How often the
  2B answers `chat`, or asks, when unsure is not measured; the intent eval has no ambiguous or multi-turn cases yet.
- Phones without the model, most of the pilot's, still get no question when unsure: the readers they have give no
  "unsure". Asking from the readers' disagreement there is the next step.
