# Which model runs on the phone

Status: decided 2026-11-01, except the order of the readers. Measured on a MacBook Air M2 with 8 GB. Every number here can
be rebuilt with `pnpm eval:intent` (scripts/eval-intent.mjs) and `node scripts/eval-intent/compare.mjs`; the full
generated tables are in [model-comparison-tables.md](model-comparison-tables.md), and every case with each reader's
answer, filterable by language, intent and outcome, is in [router-eval.html](router-eval.html) (open it in a browser). ADR 0040 and LLD §9.1 carry the
decision into the design.

## Summary

**Decision: Qwen3.5-2B, one model, on the phones that can carry it. Every other phone reads intents with the embedding
router (ADR 0042) and the word lists.** On the 978 held-out test cases:

| Reader                                              | Intent right | Download |
| --------------------------------------------------- | ------------ | -------- |
| Word lists only                                     | 30%          | none     |
| Qwen2.5-0.5B, the default until now (Ollama, 4-bit) | 26%          | 300 MB   |
| Qwen3.5-0.8B, phone build (WebLLM)                  | 31%          | 440 MB   |
| Embedding router (ADR 0042)                         | 51%          | 129 MB   |
| Embedding router, then word lists                   | 55%          | 129 MB   |
| **Qwen3.5-2B, phone build (WebLLM), new router**    | **71%**      | 1,050 MB |
| Qwen3.5-2B, Ollama 4-bit, new router                | 77%          | (dev)    |
- The router changes (reply schema, contacts across scripts, a per-language prompt) took Qwen3.5-2B from 68% to 77%
  on cases the prompt was never tuned on (p < 0.001), Hindi 70% to 88%, Kannada 65% to 76%.
- Qwen3.5-0.8B adds nothing: the embedding router then the lists score 54.8% with it and 54.8% without it. It answers
  "chat" to most messages, with or without the reply schema. So the small tier is gone.
- **Speed is the open risk**: the 2B takes 5.4 s per message in WebLLM on an M2, and 58% of messages pass the 5 s
  limit; phones are slower. A shorter prompt and real-phone timing come before the pilot.
- **One decision is open**: with the 2B, putting the language model before the embedding router scores 71% (77% on
  Ollama); the order ADR 0042 merged scores 63% (65%). See [The order of the readers](#the-order-of-the-readers).

## The question

The phone's own model names each chat message's intent (ADR 0040); when it cannot, the word lists answer. It runs in
the browser through WebLLM on WebGPU, so whatever we pick must be:
- **Open weights under a licence that allows commercial use**, in WebLLM's prebuilt list (`@mlc-ai/web-llm` 0.2.86),
  with no call to a hosted model (the Mozilla call excludes core dependence on frontier models).
- **Good in all five ways owners write:** English, Hindi, Hinglish (Hindi in Latin letters), Kannada and Kanglish
  (Kannada in Latin letters).
- **Small enough to download and fast enough to answer** on the phones our workers have, within the router's 5 s limit.

## Candidates

| Model                                         | Licence    | Web download | GPU memory (WebLLM) | Largest tensor | Tested       |
| --------------------------------------------- | ---------- | ------------ | ------------------- | -------------- | ------------ |
| Qwen2.5-0.5B-Instruct (until now the default) | Apache-2.0 | 300 MB       | 0.9 GB              | 64 MB          | yes          |
| Qwen2.5-1.5B-Instruct (until now by choice)   | Apache-2.0 | 900 MB       | 1.6 GB              | 111 MB         | yes          |
| Qwen3.5-0.8B                                  | Apache-2.0 | 440 MB       | 1.6 GB              | 121 MB         | yes          |
| Qwen3.5-2B                                    | Apache-2.0 | 1,050 MB     | 2.2 GB              | 242 MB         | yes          |
| Qwen3.5-4B                                    | Apache-2.0 | 2,300 MB     | 3.9 GB              | —              | not finished |
| Qwen2.5-7B-Instruct                           | Apache-2.0 | 4,500 MB     | 5.1 GB              | —              | no (desktop) |

GPU memory is WebLLM's own estimate (`vram_required_MB`, 4,096-token window, f16 build). The largest tensor is the
word-embedding table, which the GPU must bind as one buffer; WebGPU promises only 128 MiB per binding.

Left out, and why:
- **Qwen2.5-3B:** the Qwen Research Licence forbids commercial use.
- **Qwen3 (0.6B, 1.7B, 4B):** Apache-2.0 and in WebLLM, but Qwen3.5 replaces it at the same sizes.
- **Gemma 4 E2B:** Apache-2.0 (unlike Gemma 2 and 3, whose Gemma Terms we ruled out) and in WebLLM, but a 2.7 GB
  download and 3.4 GB of GPU memory. Worth a round of its own if Qwen3.5 disappoints on phones.
- **Llama 3.2 (1B, 3B):** the Llama licence adds an acceptable-use policy and attribution terms; weaker in Indic
  languages in published results.
- **Phi-3.5-mini, Phi-4-mini (3.8B):** MIT, but larger than the 2B with weak Hindi and Kannada.
- **SmolLM2:** English only.

## The eval set

`vectors/intents` grew from 223 cases (about 55 per language, 2 to 9 per intent) to 1,452: about 290 per language,
at least 20 per intent in every language and 30 for `market`, `find` and `chat`, which carry the most traffic and the
most confusion. Kanglish is new; the 223 founders' cases are unchanged.

| Intent     | en  | hi  | Hinglish | kn  | Kanglish | All   |
| ---------- | --- | --- | -------- | --- | -------- | ----- |
| chat       | 30  | 30  | 30       | 31  | 30       | 151   |
| market     | 30  | 30  | 30       | 31  | 30       | 151   |
| find       | 30  | 30  | 30       | 30  | 30       | 150   |
| each other | 20  | 20  | 20       | 20  | 20       | 100   |
| All        | 290 | 290 | 290      | 292 | 290      | 1,452 |

A fixed split by a hash of each case's id (`--split`): **dev**, 474 cases, the only ones looked at while changing the
prompt; **test**, 978, used only to score. 981 cases are worker messages and 471 household ones.

How the new cases were made, and what that means:
- Written by Claude agents, one per language, from the intent definitions in `model-prompt.ts` and the existing cases,
  never reusing the prompt's own examples. A third plain, a third colloquial and voice-typed, a third hard: indirect
  requests ("the tap won't stop dripping" → find) and near-misses that belong to another intent ("my sister is moving
  to Pune" → chat, "I paid the painter 4000" → chat). The loader checks every case's schema, roles and slots.
- **Harder than real traffic.** The word lists score 57% on the founders' set and 30% on the test split. Use the numbers
  to compare models; they are not a forecast of what owners will see.
- **The labels need a native speaker's review**, Hindi and Kannada first. The agents flagged their doubtful cases
  (market vs earnings for "is my 9,000 fair?", guide vs market for "how much is a PG here?"); a wrong label costs every
  model equally, but it caps what the eval can show.
- `source` is now computed (`node scripts/eval-intent/label.mjs`): `list` when today's word lists get the case right.

## Method

- Every case through each reader (core's own code): the word lists, the embedding router (ADR 0042), the language
  model alone, and the chain the app runs. Temperature 0, the router's JSON request, the
  model's hidden "thinking" turned off (Qwen3.5 thinks by default and then never answers within 120 tokens).
- **Two engines.** Ollama with 4-bit builds (`Q4_K_M`) for the broad comparison (Qwen3.5-0.8B has only an `nvfp4`
  build there, which drops the intent key and refuses a schema, so its results come from WebLLM only); and **WebLLM itself, with the exact q4f16 builds a phone downloads**, in Chromium on the Mac's GPU, for
  the finalists (`--webllm`, scripts/eval-intent/webllm.mjs). An earlier quick run used Ollama's default Qwen3.5 tags,
  which are 8-bit (`mxfp8`); those numbers flattered Qwen3.5 against 4-bit Qwen2.5 and are not used here.
- Time limit 30 s (60 s for WebLLM and 7B) so that a slow Mac does not count as a wrong answer; speed is measured on
  its own below.

## Results

All on the 978 test cases. The full tables, by intent, with slots and paired tests, are in
[model-comparison-tables.md](model-comparison-tables.md); each case, with what every reader named, in
[router-eval.html](router-eval.html).

### Each model alone, by language

| Model, router, engine       | All (95% CI) | en  | hi  | Hinglish | kn  | Kanglish |
| --------------------------- | ------------ | --- | --- | -------- | --- | -------- |
| Qwen2.5-0.5B, old, Ollama   | 26% (23–29)  | 44% | 20% | 23%      | 18% | 23%      |
| Qwen2.5-1.5B, old, Ollama   | 49% (46–53)  | 75% | 52% | 57%      | 28% | 35%      |
| Qwen3.5-2B, old, Ollama     | 68% (65–71)  | 84% | 70% | 77%      | 65% | 41%      |
| Qwen2.5-1.5B, new, Ollama   | 56% (53–59)  | 77% | 65% | 62%      | 30% | 44%      |
| Qwen3.5-2B, new, Ollama     | 77% (74–80)  | 87% | 88% | 82%      | 76% | 52%      |
| Qwen3.5-0.8B, new, WebLLM   | 31% (28–34)  | 49% | 26% | 31%      | 24% | 25%      |
| **Qwen3.5-2B, new, WebLLM** | 71% (68–74)  | 84% | 73% | 79%      | 65% | 54%      |
- **Qwen3.5 beats Qwen2.5 at every size we could compare**, most in Kannada (28% to 65% at similar sizes).
- **The phone's own 2B build is 6 points below Ollama's 4-bit build** of the same model (100 cases only Ollama got
  right, 43 only WebLLM; same intent 81% of the time). The builds quantise differently; 71% is the number for phones.
- **Where the 2B still fails:** `setRule` (51%), Kanglish (54%), and on the phone build `remember` (23%: notes read as
  chat, find or market). These are the next prompt work.
- Qwen3.5-4B was stopped after 90 minutes on the 8 GB Mac and Qwen2.5-7B was not run on the full set: neither fits a
  phone, and the re-measure was scoped to models up to 2B.

### What the router changes did

Qwen3.5-2B on Ollama, old prompt against new, same 978 cases: 130 cases only the new one got right, 40 only the old.

| Intent     | Old | New | Change                                                      |
| ---------- | --- | --- | ----------------------------------------------------------- |
| find       | 60% | 90% | a trade word no longer means market                         |
| setRule    | 16% | 51% | permission examples, "don't tell", listed before askContact |
| moving     | 73% | 87% | "coming to Bengaluru", Kannada examples                     |
| earnings   | 81% | 93% |                                                             |
| askContact | 73% | 80% | contacts matched across scripts                             |
| market     | 91% | 86% | fewer things called market, a few real ones lost            |
| chat       | 71% | 65% | the catch-all lost to the more specific intents             |

Of the old router's model replies, 5% gave no usable route; with the schema, 1%. The prompt was tuned in three rounds
on the dev split (67%, 73%, 71%, 79%), then frozen and scored on test. The error analysis that motivated the changes
looked at the whole set's mistakes, but no example in the prompt is an eval case (highest word overlap 0.67).

### The order of the readers

ADR 0042 runs the embedding router first and the language model only when it is unsure. With a weak language model
that is right; with the 2B it costs accuracy, because the embedding router answers 80% of messages itself and is right
on fewer of them than the 2B would be:

| Chain                                         | Qwen3.5-2B, WebLLM | Qwen3.5-2B, Ollama | Qwen3.5-0.8B, WebLLM |
| --------------------------------------------- | ------------------ | ------------------ | -------------------- |
| Embedding router, then model, then word lists | 63.5%              | 64.9%              | 54.8%                |
| Model, then embedding router, then word lists | 71.3%              | 77.4%              | 31.3%                |
| Embedding router, then word lists (no model)  | 54.8%              | 54.8%              | 54.8%                |

The trade: model first runs the language model on every message, 5.4 s each on an M2 today, instead of on the fifth
the embedding router is unsure of. Not decided here; it is the owners' call between accuracy and waiting.

## Speed on the phone's engine

WebLLM on the M2's GPU, the routing prompt of 935 to 1,330 tokens (the intents, the rules, the examples and the slot
values), every one of the 978 test messages, after loading:

| Model        | Median per message | 95th percentile | Over the 5 s limit | Reads the prompt at | Writes at    |
| ------------ | ------------------ | --------------- | ------------------ | ------------------- | ------------ |
| Qwen3.5-0.8B | 3.4 s              | 4.2 s           | under 5%           | ~430 tokens/s       | ~25 tokens/s |
| Qwen3.5-2B   | 5.4 s              | 6.3 s           | 58%                | ~260 tokens/s       | ~16 tokens/s |

Reading the prompt is most of the time. A phone's GPU is slower than an M2's (we expect two to four times, not yet
measured), so with today's prompt the 2B misses the limit on every phone we know of and the speed guard turns it off.
**The prompt's length, not the model, decides whether the 2B is used at all.**

## What Qwen3.5-2B needs from a phone

All of these, or the phone uses the embedding router and the word lists:

| Needs                 | Qwen3.5-2B                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------ |
| WebGPU                | Chrome 121+ on Android 12+ with a GPU Chrome enables (most Adreno, Mali); Safari on iOS 26 |
| Memory Chrome reports | 8 (phones with about 8 GB or more; Chrome reports a 6 GB phone as 4)                       |
| One GPU buffer of     | 242 MiB, the word-embedding table (WebGPU promises 128 MiB)                                |
| GPU memory            | about 2.2 GB                                                                               |
| Free storage          | about 1.25 GB                                                                              |
| Download, once        | about 1 GB                                                                                 |

In practice: Android phones with 8 GB or more whose GPU binds 256 MiB, upper mid-range and flagships. **iPhones are
not offered the model**: Safari reports no memory, iPhones from 4 to 8 GB look the same, and a 1 GB download that ends
in a load the phone cannot hold is worse than the embedding router. Speed is the real floor: see above.

## Decision

1. **Qwen3.5-2B is the phone's language model, and the only one** (`plugins/gigsync-llm/src/catalog.ts`), offered
   only where the gate above passes. Qwen2.5 and the Qwen3.5-0.8B tier are removed; Settings has no size choice.
2. **The router keeps its changes:** the reply schema, contacts across scripts and spellings, and the per-language
   prompt with its rules (ADR 0040, amendment of 2026-11-01).
3. **Development uses the same model:** `qwen3.5:2b-q4_K_M` in Ollama (README); every other model was deleted from
   the eval machine.

## What comes next

- **A shorter prompt, then timing on real phones.** The 2B must answer in under 5 s on an 8 GB Android phone, or it
  helps no one. Candidates: fewer examples per intent now that the schema holds the format, and the intents' meanings
  in fewer words; each change re-measured on dev, then test.
- **Decide the order of the readers** (above).
- **Native-speaker review of the labels**, Hindi and Kannada first, and of the doubtful cases the writers flagged.
- **`setRule`, `remember` and Kanglish** are the weakest; more contrasting examples, measured on dev.
- **Gemma 4 E2B** (Apache-2.0, in WebLLM) deserves one round if the 2B cannot be made fast enough.

The embedding router's sayings share 7 cases word for word with the eval set (greetings such as "good morning") and
6 more closely; under 1% of cases, left in and noted here.
