# ADR 0040: The phone's own model reads what the chat is asking; keyword lists only when it has none

Date: 2026-10-31. Status: accepted. Amends [LLD §3.5 and §8.4](../gigsync/LLD.md) (intent only "when the keyword
router is unsure"); keeps [ADR 0010](0010-no-cloud-model-in-gigsync.md) (no cloud model reads what owners type).
Amended 2026-10-31: the web engine is WebLLM running Qwen2.5-0.5B-Instruct ([Amendment](#amendment-2026-10-31-the-web-engine-is-webllm)).
Amended 2026-11-01 (round 2): a shorter prompt, 4.0 s per message
([Amendment](#amendment-2026-11-01-round-2-a-shorter-prompt)).
Amended 2026-11-01: Qwen3.5-2B on the phones that can carry it, and a router that reads every language
([Amendment](#amendment-2026-11-01-qwen35-2b-and-a-router-for-every-language)).

## Context

Every intent in Talk and Find is matched today by word lists: editing the card, offering to help newcomers, moving,
earnings, the city guide, then remember, find, ask or chat (`packages/core/src/router/*`, the chain in
`apps/mobile/src/screens/Agent.tsx`). The model router that `agent.ts` names as M1 was never built, so each round added
another list. Lists miss ordinary phrasings ("is ₹8,000 fair for a cook?") and the miss falls silently through to plain
chat. LLD §8.4's "model only when the keyword router is unsure" cannot help here: a list that misses does not know it
missed, it looks like a confident "chat".

A cloud model would read every owner, including the low-end phones that have no model of their own, but chat text
would then leave the phone. The founders chose that it does not.

## Decision

1. **One model router behind the existing `Router` interface**, covering every chat intent in one place: edit card,
   help newcomers (offer, stop), moving, earnings, market price, find, remember, ask self, ask contact, set rule, chat.
   The chain in `Agent.tsx` becomes one call that returns a route.
2. **The model only names the intent and fills its slots**, from a fixed list: trade, area, city, amount, contact,
   card field, note text. Its reply is JSON checked by a zod schema in core; slot values must be ones core knows (a
   trade or area from the lexicon, a contact the owner has, an amount that appears in the words). Code then runs the
   action and computes every number, as before (ADR 0033's rule).
3. **Model first when the phone has one.** Auto uses the phone's own engine (LiteRT-LM, Apple Foundation Models,
   WebLLM in the web app, see the amendment; Ollama in development builds) when Settings' rules say it is usable. The keyword
   lists answer when there is no usable model, when the model is slow past a time limit, or when its reply fails the
   schema or names a slot core does not know. Lite mode stays complete.
4. **Chat text never leaves the phone for routing.** No server or cloud fallback. ADR 0010 stands.
5. **The existing word lists stay as the fallback** and keep their tests; new intents add an enum value and a few
   prompt examples, plus fallback words only where lite mode must handle them.
6. **Measured, not assumed.** An eval set of phrasings in English, Hindi, Kannada and Hinglish (including the ones the
   lists miss) runs against the dev model and the keyword router, reporting accuracy per intent; the build reports both.

## Consequences

- Owners whose phones run a model are understood in their own words; the rest get today's behaviour, no worse.
- Budget Android phones, most of GigSync's workers, usually have no usable model and stay on the lists. Their misses
  are only reduced by better lists; this is the accepted cost of keeping chat text on the phone.
- A model call adds latency to each message on phones that have one; the time limit bounds it.
- Routing quality on real phones is unknown until the eval runs on test devices (LLD §8.5).
- First eval (2026-10-31, qwen2.5:1.5b on a Mac, 212 cases not yet reviewed by native speakers): keywords 58%, model
  66%, model first with the lists as fallback 67%; English 84%, Hindi 69%, Kannada 49% against 61% for the lists
  alone. The founders chose to keep the model first in every language, Kannada included, rather than route Kannada by
  the lists only; the Kannada figure is to be rechecked with native-reviewed cases on a real phone's model.

## Amendment 2026-10-31: the web engine is WebLLM

The web app, also when installed to the home screen on Android or iPhone, runs its own open model on the phone:
[WebLLM](https://github.com/mlc-ai/web-llm) (`@mlc-ai/web-llm` 0.2.86, Apache-2.0) on WebGPU, in a Web Worker. No
browser built-in model is used (Chrome's Gemini Nano engine is removed): the model must be open-weights, ours to
choose, and the same on every browser that can run it. Details in [LLD §9.1](../gigsync/LLD.md).
1. **Model.** Default Qwen2.5-0.5B-Instruct (Apache-2.0), 4-bit, about 300 MB to download (WebLLM ids
   `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`, or `-q4f32_1-MLC` where the GPU has no `shader-f16`). Qwen2.5-1.5B-Instruct
   (about 900 MB) only when the owner chooses it in Settings on a phone that can hold it. Why: the founders' choice of
   the family the first eval used (qwen2.5:1.5b, 66% model-only against 58% for the lists), at the smallest size a
   budget phone can download and run.
2. **Gate.** Offered only where WebGPU gives an adapter whose limits meet WebLLM's (buffers of 256 MB, bindings of
   128 MB, 32 KB workgroup storage, 10 storage buffers per stage), `navigator.deviceMemory` is at least 4 (8 for the
   1.5B) where the browser reports it (an iPhone does not: allowed, and a failed load falls back to lite mode), and
   storage has room for the model plus 200 MB. The app then asks `navigator.storage.persist()`.
3. **Download rules.** Never without the owner's tap: one quiet offer in the chat after sign-in, shown until they
   answer, and the button in Settings. Where the browser reports mobile data or the data saver, the offer says it
   uses mobile data, and a download that stopped never resumes by itself; where it cannot tell (iPhone), the app
   asks; only on Wi-Fi does a stopped download carry on by itself. WebLLM's cache keeps the shards already fetched,
   so a resume continues. A model the browser evicted is offered again, never fetched behind the owner's back.
   The files come from Hugging Face for now; `VITE_MODEL_BASE_URL` moves them (to Cloudflare R2) without a code change.
4. **Speed guard.** Each routing answer's time is measured. When 3 of the first 5 on a phone take longer than the
   router's limit (`MODEL_ROUTE_TIMEOUT_MS`, 5 s), Auto stops using the model there and Settings says so once, with
   "Try again". On-device (chosen by hand) still uses it.

Consequences:
- Chat text still never leaves the phone; the only network use is fetching the model's files once.
- Phones without WebGPU stay on the lists: Chrome on Android before version 121 or Android 12, GPUs Chrome does not
  enable, and iPhones before iOS 26.
- The routing prompt is about 1,560 tokens for a worker. A Mac's GPU answers in about 3.5 s; a phone will be slower,
  and the speed guard may turn the model off on many budget phones (removed 2026-11-03, ADR 0042). Cutting three market examples saved 8% of the
  prompt but lowered accuracy (69% to 68% combined, English 84% to 79%), so the prompt is unchanged.
- The first eval showed Kannada worse with qwen2.5:1.5b (49%) than with the lists (61%); Qwen2.5-0.5B is untested on
  Indic text, and likely weaker. It must be measured on real phones before the pilot.
- WebLLM 0.2.86 fails JSON mode without a schema; the engine passes `{"type":"object"}` and core checks the fields.

## Amendment 2026-11-01: Qwen3.5-2B, and a router for every language

Measured on a 1,452-case eval (five ways of writing, a fixed dev/test split) in
[model-comparison.md](../gigsync/model-comparison.md); the numbers below are the 978 held-out test cases.
1. **Model.** Qwen3.5-2B (Apache-2.0, about 1 GB) replaces Qwen2.5, and is the only model. Qwen2.5-0.5B, the default
   until now, named 26% of intents right, below the word lists' 30%; Qwen3.5-0.8B named 31% and added nothing to
   ADR 0042's embedding router, which every phone can carry. The 2B is offered only where Chrome reports 8 GB and the
   GPU binds one 242 MiB buffer (its embeddings; WebGPU promises 128 MiB); not on iPhones, where Safari reports no
   memory. Every request turns Qwen3.5's hidden "thinking" off, or it never answers within the router's 120 tokens.
2. **The reply is held to a JSON Schema** (router/reply-schema.ts): the intents this chat allows, the real trades and
   areas, the owner's own contacts. WebLLM's grammar and Ollama's `format` enforce it, so no intent, trade or contact
   can be invented and the JSON cannot break; core still checks every value.
3. **Contacts match across scripts and spellings** (contacts/names.ts): "Ravi" finds "रवि", "Meena" finds "ಮೀನಾ",
   "Asha" finds "Asha didi"; a near spelling only when one contact fits. The contact must also be named in the message,
   so a model held to the list cannot pick one at random.
4. **The prompt shows examples only in the owner's language and its Latin-letter form** (router/examples.ts, shared with
   ADR 0042's index): English; Hindi with Hinglish; Kannada with Kanglish. More examples where models confuse intents,
   in contrasting pairs, five short rules for those pairs, and setRule listed just before askContact. No example is an
   eval case (the highest word overlap with one is 0.67).

Consequences:
- Qwen3.5-2B alone: 68% to 77% on the test cases on Ollama (Hindi 70% to 88%, Kannada 65% to 76%, Kanglish 41% to
  52%, setRule 16% to 51%); the phone's own WebLLM build scores 71%. The prompt is no longer than before (3,400 to 4,300 characters, against 2,850 to 4,350).
- Speed is now the limit, not accuracy: in WebLLM on an M2 the 2B takes 5.4 s per message, and 58% of messages pass
  the 5 s limit; phones are slower. Real-phone timing, and a shorter prompt, come before the pilot.
- With ADR 0042's embedding router answering first, the 2B's chain scores 63%; with the language model first, 71%
  (WebLLM). The order is an open decision recorded in model-comparison.md.

## Amendment 2026-11-01, round 2: a shorter prompt

The prompt now shows examples only in the script the message is written in (a Kannada-script message sees Kannada
examples; a Kannada owner typing in Latin letters sees Kanglish), and says what each slot holds without listing the
values the reply's schema already enforces. A second askContact and askSelf example per script makes up for the
examples no longer shown. 740 to 870 tokens instead of 890 to 1,300.

Consequences, on the 978 test cases with the phone's own build (WebLLM, M2):
- 5.4 s to 4.0 s per message (median), and messages over the 5 s limit from 58% to 3%.
- 71.2% to 69.4% of intents right: 62 cases only the old prompt got right, 45 only the new (p = 0.12). Kanglish lost
  most (54% to 47%), the place for the next examples.
- Shorter intent meanings (−9 points on dev) and examples written without JSON (−4) were tried and left out.
- With ADR 0042's grown sayings the reader order matters little: embedding router first 67.3%, model first 69.8%, and
  the first is faster. ADR 0042's order stays. (Changed 2026-11-03: the model reads first; see ADR 0042's amendment.)
- Read in careful English translations, the 2B names 91% of the non-English test messages right against 72% in their
  own words (Kanglish 50% to 93%): it knows the intents and reads romanized Kannada badly. That is a ceiling no phone
  translator reaches; transliteration into the native script is the cheap step to measure next
  ([model-comparison.md](../gigsync/model-comparison.md#translating-to-english-first-the-ceiling)).
