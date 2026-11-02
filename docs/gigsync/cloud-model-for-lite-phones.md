# A cloud model for phones that cannot run one: analysis and plan

Status: analysis, 2026-11-03. Nothing here is built or decided. It answers one question: should GigSync host an open
~7B model in the cloud for the phones that cannot run Qwen3.5-2B on the phone? The decision belongs to the founders,
because it reverses [ADR 0010](../adr/0010-no-cloud-model-in-gigsync.md) and
[ADR 0040](../adr/0040-on-phone-model-router.md) §4.

## Recommendation

**Do not build it now.** Spend the next two to three weeks on lite mode, and run the cloud candidates on the eval set
(eval data only, no user's words) so the decision rests on measurements. Build a cloud reader only if the gate in
[Phase 1](#phase-1-only-if-the-gate-passes-a-routing-only-opt-in-cloud-reader) passes. If it does, it should be much
narrower than "a 7B model in the cloud":
- **intent routing only**, never notes, open chat, prices or anything the other side wrote;
- only for the roughly 15% of messages the phone's embedding router cannot place;
- **off by default**, switched on per owner after a consent sheet, with a mark on every message that left the phone;
- on Workers AI (no GPU of our own, and no new company to trust), behind a narrow port, not behind `Model`.

The rest of this document says why.

## The weakest point: what the 7B would buy is unmeasured, and what is measured is small

The proposal assumes a cloud 7B closes a large gap. The eval says otherwise, as far as it reaches. On the 978 held-out
test cases ([model-comparison.md](model-comparison.md), recomputed from `router-eval.html` for this document):

| Reader, as the phone would run it                                 | All | en  | hi  | Hinglish | kn  | Kanglish |
| ----------------------------------------------------------------- | --- | --- | --- | -------- | --- | -------- |
| Lite: embedding router, then word lists (every phone today)       | 62% | 77% | 63% | 55%      | 58% | 57%      |
| Embedding router, then the phone's 2B (WebLLM), then lists        | 67% | 80% | 71% | 60%      | 65% | 60%      |
| Embedding router, then a full 2B (Ollama 4-bit, a cloud stand-in) | 70% | 82% | 72% | 62%      | 69% | 62%      |
| The 2B alone, in Ollama's 4-bit build                             | 76% | 89% | 83% | 82%      | 73% | 50%      |
| A 7B (any)                                                        | —   | —   | —   | —        | —   | —        |
- **The phone's own 2B adds 5 points over lite** in the order the app runs (ADR 0042). A cloud 2B adds 8. A 7B has
  never been run on the full set: Qwen2.5-7B was left out and Qwen3.5-4B was stopped after 90 minutes on the 8 GB Mac.
  Every claim that a 7B closes the gap is a guess until it is measured.
- **Kanglish, the way many Bengaluru workers type, is where the language model is weakest.** The 2B alone scores 50%
  in Kanglish against lite's 57%. The translation ceiling study shows why: the 2B reads the same messages at 93% in
  clean English. The failure is reading romanized Kannada, and a bigger model of the same family is not guaranteed to
  fix it.
- **The eval is harder than real traffic.** The word lists score 57% on the founders' cases and 30% on the test split.
  These numbers compare readers; they do not say how often a real owner is misunderstood.
- **Most lite misses cost a tap, one costs more.** Of lite's 372 misses, 133 fall through to plain chat (the owner
  rephrases) and 239 show the wrong card. Most cards do nothing on their own: `askContact` makes a draft the owner
  sends, `setRule` and `find` answer "later", `editCard` opens the interview. The exception is `helpStop`: it unlists
  a mentor at once, with no question (`apps/mobile/src/talk/listingChat.ts`, `stopHelping`). Lite sends 13 test
  messages there wrongly, mostly offers to help ("naanu mentor aagtini"); the phone's 2B sends 6 and a full 2B 6. **A
  bigger model makes this rarer, not impossible; a confirmation makes it harmless**, and is needed with any reader.
  The commonest misses are `find` read as chat (29), notes read as chat (26) and `helpStop` read as `helpOffer` (18).

## What lite mode misses, by intent

Lite against a full 2B (Ollama, alone), test split:

| Intent     | Lite | 2B  | Intent   | Lite | 2B  | Intent    | Lite | 2B  |
| ---------- | ---- | --- | -------- | ---- | --- | --------- | ---- | --- |
| remember   | 26%  | 54% | askSelf  | 58%  | 45% | helpStop  | 69%  | 85% |
| find       | 52%  | 94% | chat     | 60%  | 68% | guide     | 72%  | 76% |
| askContact | 53%  | 70% | market   | 64%  | 81% | moving    | 75%  | 87% |
| setRule    | 54%  | 60% | editCard | 67%  | 73% | helpOffer | 76%  | 88% |
| earnings   | 82%  | 90% |          |      |     |           |      |     |

Households fare worse than workers in lite (58% against 64%). `find` and `remember` are the gaps worth closing, and
both have cheaper fixes than a cloud model (Phase 0).

## Which tasks need a model at all

Every call to `Model.generate` in core today, and whether a cloud model could take it:

| Task (file)                                                | What the model reads                | Lite answer                    | Cloud?                         |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------ | ------------------------------ |
| Intent and slots (`router/model-route.ts`)                 | The owner's raw message             | Embedding router, then lists   | **The only candidate**         |
| Open chat reply (`experts.ts`, default)                    | The owner's raw message             | "Needs a model" card           | No: most sensitive, weakest    |
| Answer from notes (`experts.ts`, askSelf)                  | The owner's private notes           | Quotes the notes               | No: notes never leave          |
| Questions to a household (`job/question-model.ts`)         | **The other side's words**          | Standard questions             | No: sealed for one device      |
| Answer from own words (`job/answer-model.ts`)              | The other side's question           | Goes to the owner              | No: sealed for one device      |
| Price questions (`interview/price-model.ts`)               | The job and the owner's answers     | Fixed drivers (ADR 0041 §2)    | No: ADR 0041 §5                |
| Job type outside the trades (`interview/job-type.ts`)      | The owner's words                   | Skill list on the phone (0047) | No: ADR 0047 covers it         |
| Need and scope reading (`need-model.ts`, `scope-read.ts`)  | English sentences                   | Lists and embedding            | Low value: English is best     |
| Tactic (`job/tactic.ts`)                                   | The owner's words, numbers removed  | The owner's usual tactic       | Low value: one of three        |
| Wording facts (`explain-model`, `market`, `moving/phrase`) | Facts built by code                 | Template sentences             | Low value: templates are right |
| Pick a counter-term (`job/terms-model.ts`)                 | A list code generated               | The closest option             | Low value                      |
| Guide section (`landing/ask-model.ts`)                     | A visitor's question                | Section list                   | Low value                      |
| Translation between owners (`adapters/translate.ts`)       | **The other side's sealed message** | On-device packs                | No: breaks end-to-end sealing  |

**A narrower use limited to structured, scrubbed inputs gets almost none of the value.** The tasks whose inputs are
already structured (wording facts, picking a term) are the ones where a template already says the right thing, and the
model only rephrases it. The value is in reading what an owner typed, which is exactly the text ADR 0040 keeps on the
phone. Scrubbing names, numbers and addresses does not make it harmless: "my employer shouts at me", or a harassment
note, is sensitive with every number removed. The real narrowing is **by task** (routing only), **by message** (only
what the embedding router cannot place) and **by owner** (only those who say yes).

Two tasks must never go to the cloud, with or without the owner's consent: anything that reads the other side's
words, which were sealed for the owner's devices only and whose writer never agreed, and the owner's notes.

## The alternatives

| Option                                       | Gain over lite (test split)               | Cost per routing call | Data leaves the phone         | Verdict                |
| -------------------------------------------- | ----------------------------------------- | --------------------- | ----------------------------- | ---------------------- |
| Better lite mode (Phase 0)                   | estimated +4 to +8, to be measured        | none                  | no                            | **Do first**           |
| Workers AI, open model ≤30B, routing only    | unmeasured; a 2B stand-in gives +8        | ₹0.006 to ₹0.01       | yes, to Cloudflare            | Measure; gate          |
| Smaller cloud model (2B to 3B)               | +8 for a 2B (measured, not on Workers AI) | under ₹0.01           | yes                           | Only with self-hosting |
| Hosted API, no-retention contract (Sarvam)   | unmeasured; Indic-tuned                   | about ₹0.005          | yes, to a new company (India) | Second choice          |
| Self-hosted 7B on India-region GPUs          | unmeasured                                | ₹1.3 to ₹3.1 at pilot | yes, to our own servers       | Not before 100× pilot  |
| Translate to English on the phone, then lite | ceiling +11 on non-English                | none                  | no                            | Transliterate first    |

Notes on each:
- **Better lite mode** (the [Phase 0](#phase-0-now-to-g1b-no-cloud) list): the embedding router's accuracy follows
  its sayings (ADR 0042: 77% leave-one-out on the founders' cases), Kannada-script sayings are missing, and Kanglish
  and Hinglish gain most from a script change.
- **Workers AI** offers no Qwen3.5 and no Indic-tuned chat model. The candidates in the 2B to 30B range are
  `qwen3-30b-a3b-fp8` ($0.051 in, $0.335 out per million tokens), `gemma-4-26b-a4b-it` ($0.10, $0.30),
  `llama-3.1-8b-instruct-fp8-fast` ($0.045, $0.384) and `granite-4.0-h-micro` ($0.017, $0.112) (pricing page,
  2026-10-20). Its data-usage page states zero retention for plain inference and no training on customer content, but
  says nothing about where inference runs: the request may leave India.
- **A smaller cloud model** is what the eval measured (a 2B); Workers AI's smallest Qwen is the 30B mixture of
  experts, so a small cloud model means hosting it ourselves, with the self-hosting costs below.
- **Sarvam** is Indian, hosts in India and tunes for Indic languages; its published prices conflict between pages
  (₹4 in and ₹16 out per million tokens, or free) and no retention terms were found. A new processor and a startup's
  terms are risks Cloudflare does not add.
- **Self-hosting** gives the most control (our region, our logs) at the highest cost and an on-call burden two
  founders cannot carry in the pilot.
- **Translation**: in clean English the embedding router reads non-English messages at 69% against 58%, and the 2B at
  91%. No phone translator matches clean translation, and Hinglish and Kanglish, where the gain is, are what the
  translators read worst (they expect native script). Transliteration (Kanglish to Kannada script, Hinglish to
  Devanagari) is the cheap step; a translator model (IndicTrans2 distilled, 200 to 300 MB) comes after.

## Cost

Assumptions, all to be replaced by pilot data: the pilot (ROADMAP G5) has about 160 people (50 workers, 10 newcomers,
about 100 households); 70% use lite phones; 60% are active on a day; each sends 20 messages; 1,000 tokens in and 60
out per call; ₹88 to the dollar. If the cloud reads every lite message, that is about 40,000 calls a month at the
pilot and 400,000 at 10×. If it reads only what the embedding router cannot place (15%), divide by about seven.

| Option, every lite message                   | Per call              | Pilot, a month            | 10× pilot, a month               |
| -------------------------------------------- | --------------------- | ------------------------- | -------------------------------- |
| Workers AI `qwen3-30b-a3b-fp8`               | ₹0.006                | ₹0 (inside the free tier) | about ₹2,200                     |
| Workers AI `gemma-4-26b-a4b-it`              | ₹0.010                | about ₹125                | about ₹3,900                     |
| Sarvam, at its listed ₹4 and ₹16             | ₹0.005                | about ₹200                | about ₹2,000                     |
| One L4 GPU in Mumbai, always on (E2E to AWS) | —                     | ₹26,000 to ₹62,000        | the same; one L4 holds 10×       |
| Two L4s, for a second when one fails         | ₹1.3 to ₹3.1 at pilot | ₹52,000 to ₹1,24,000      | the same (₹0.13 to ₹0.31 a call) |
- Workers AI gives 10,000 neurons a day free (about $0.11) and charges $0.011 per 1,000 after.
- L4 prices: E2E Networks ₹36 to ₹49 an hour, AWS `g6.xlarge` in Mumbai about $0.97 an hour (third-party listings,
  October 2026; confirm before any purchase). Serverless GPUs avoid the idle cost but a 7B's cold start takes tens of
  seconds, past any timeout a chat can live with, unless one instance is kept warm, which is the always-on cost again.
- For scale: the pilot's revenue is under ₹30,000 a year across every line ([REVENUE.md](REVENUE.md)). One self-hosted
  GPU costs that in a month. Serverless per-token pricing is a rounding error at either scale, so **cost does not
  decide between serverless options; trust, region and accuracy do.**

## Latency on Indian mobile networks

Estimates, to be measured on real phones on Jio and Airtel 4G in Bengaluru before any rollout:

| Path                                      | Typical                         | Bad network (95th percentile) |
| ----------------------------------------- | ------------------------------- | ----------------------------- |
| Embedding router on the phone             | tens of ms                      | the same: no network          |
| The phone's 2B (WebLLM)                   | 4 s on an M2; a phone is slower | over the 5 s limit            |
| Cloud: radio and TLS to Cloudflare's edge | 50 to 150 ms                    | 0.5 to 2 s, or no answer      |
| Cloud: to the GPU, if outside India       | +40 to 100 ms                   | the same                      |
| Cloud: model, 1,000 tokens in, 60 out     | 0.4 to 1 s                      | 1 to 3 s under load           |
| Cloud in total                            | about 1 to 1.5 s                | 3 s and more                  |

A cloud read is faster than the phone's own 2B when the network is good, and useless when it is not. The router must
give up after about 2.5 s and answer with lite, so the same message can be read differently on the bus and at home.
That inconsistency is a cost of its own.

## Offline

Lite mode stays complete (VISION §9: "works on a 4 GB phone, no model, offline, every screen"). Offline or past the
timeout, the cloud reader is skipped, never queued: a message is never sent later for a model to read. The pilot's
success criteria must be met with the cloud reader off.

## DPDP Act

Not legal advice; a lawyer reads the final consent text. The DPDP Rules were notified on 13–14 November 2025; consent
managers follow in November 2026 and most obligations, notice and consent included, apply from **13 May 2027, before
the G5 pilot**. So a cloud reader must be built to the full rules from day one:
- **GigSync is the data fiduciary and the model host a processor.** A written contract with the host (Cloudflare's
  data processing terms; Sarvam would need one) and reasonable security safeguards are GigSync's duty.
- **Consent must be free, specific, informed, unconditional and unambiguous, by a clear action**, after a notice that
  says what is processed and why, and can be withdrawn as easily as it was given. It cannot be a condition of using the
  app, which lite mode makes true. The notice must be available in the owner's language (Kannada and Hindi are in the
  Eighth Schedule).
- **GigSync must be able to prove consent** was given, so the server keeps a record (owner, notice version, time,
  withdrawal): a new, small piece of personal data.
- **Transfers abroad are allowed** unless the government lists the country; Workers AI does not promise India. Allowed
  is not the same as what workers were told: the notice must say where the words may go.
- Zero retention at the host and no request bodies in our own logs keep breach exposure (72-hour reporting) small.

## Prompt injection and abuse

- **The routing reply cannot do much.** It is held to a JSON Schema of the intents and trades (`router/reply-schema.ts`)
  and core checks every slot, so a hostile message can at worst pick a wrong intent, the same as a misread. Workers AI's
  JSON mode must be checked per model; core's checks stay whatever the host enforces.
- **The owner's contacts must not leave.** Today the schema lists the owner's contact names. The cloud reader returns
  `askContact` and the words naming the person; the phone matches them to contacts (`contacts/names.ts`) as now.
- **The endpoint is the new exposure.** A route that forwards any prompt is a free model for anyone with an account. The
  Worker must build the prompt itself from `{ text, lang, script }`, cap the text (280 characters), rate-limit per
  owner, and refuse anything else.
- **The other side's words never reach it** (see the task table), so a household cannot write a message that steers a
  worker's cloud call.

## Fit with the stack

- Workers have no GPU; **Workers AI is the only way to stay on Cloudflare** with one binding in `wrangler.toml` and no
  new vendor, key or network path. Self-hosting means a second cloud, a VPN or a public endpoint, and an on-call rota.
- **Not behind the `Model` port.** `Model.generate(prompt)` takes any prompt, and core calls it for notes, open chat and
  the other side's words. A cloud engine behind it would send all of those. The cloud reader needs its own narrow port
  (say `RemoteIntent.read(text, lang)`) called from one place: `router/route-chat.ts`, after the embedding router and the
  phone's model, before the word lists.
- Mozilla's Human-Scale AI call excludes core dependence on frontier models. An open model on Workers AI is not
  frontier, but "nothing an owner types leaves the phone for a model" is part of GigSync's story to that call (deadline
  20 November 2026). Changing it now changes the application.

## The plan

### Phase 0: now to G1b, no cloud

1. **Confirm before `helpStop` unlists a mentor**, whatever reader named it: a separate fix, needed now.
2. **Ask instead of guessing** when the embedding router's two nearest intents disagree or the margin is small: two
   chips ("Save as a note" / "Find a worker"). A misread becomes one tap, and the tap is a labelled miss.
3. **Kannada-script sayings**: Kannada fell from 63% to 58% in round 2 because the new sayings were Latin-letter.
4. **Transliterate before the embedding router**: Kanglish to Kannada script, Hinglish to Devanagari. Measure on dev,
   then test, as model-comparison.md does.
5. **Sayings for `find`, `remember` and `askContact`**, the three widest gaps, never copied from eval cases.
6. **Count misses on the phone**: chip taps and "not what I meant", as aggregate counts with no words, so G1b testing
   says how often lite fails real owners.
7. **Measure the cloud candidates on the eval set only** (synthetic cases, no owner's words): `qwen3-30b-a3b-fp8`,
   `gemma-4-26b-a4b-it`, `llama-3.1-8b-instruct-fp8-fast` on Workers AI, through `pnpm eval:intent`, in the chain and
   alone. About 1 million tokens a model, inside or near the free tier. Needs the founders' yes to use the Cloudflare
   account for it.

### The gate

A cloud reader is built only if all of these hold:
- the best cloud candidate, run after the embedding router, beats improved lite by **at least 8 points** on the test
  split and loses in no language, Kanglish included;
- G1b's counts show lite misreads real owners often enough to matter (the founders set the figure; 15% of messages is
  a starting point);
- the founders amend ADR 0010 knowing that it said "even with consent", and the union reviews the consent sheet;
- Cloudflare says in writing where inference runs for the chosen model, or the notice says it may leave India.

### Phase 1, only if the gate passes: a routing-only, opt-in cloud reader

1. `POST /v1/route` on the API Worker: builds the routing prompt from `{ text, lang, script }`, calls Workers AI with
   the reply schema, returns `{ intent, slots, contactWords }`; 280-character cap, per-owner rate limit, request bodies
   never logged (Workers Logs off for the route), no AI Gateway logging or caching.
2. The phone scrubs the message with the ADR 0015 detectors (phone numbers, UPI ids, addresses) before sending.
3. A `RemoteIntent` port in core, called only in `route-chat.ts`, only for messages the embedding router cannot place,
   with a 2.5 s timeout and lite after it.
4. Consent sheet in the owner's language, read aloud, default off, like ADR 0023's: who reads the words, what for,
   for how long (not kept), what never goes (notes, job chats, others' messages), how to stop. Settings has the switch;
   each message that left the phone carries a small mark that opens the same switch.
5. A server-side kill switch, and the eval run against the chosen model in CI.

### Phase 2: the pilot (G5)

Offered to lite-phone owners after the union's review. Measured on the phone, in aggregate: how many say yes, how many
withdraw, chip taps with and without the cloud, latency p50 and p95, timeouts. Removed if fewer than a fifth of
offered owners keep it on, or if p95 stays above 3 s.

### Never

Notes, open chat, prices (ADR 0041 §5), anything the other side wrote, translation of sealed messages.

## What would have to change

- [ADR 0010](../adr/0010-no-cloud-model-in-gigsync.md): an exception for routing an owner's own message, as
  [ADR 0023](../adr/0023-speech-on-device-first-cloud-with-consent.md) made for speech. ADR 0023's case was that the mic
  fails completely without the cloud; here lite works. That difference is why this plan asks for the gate first.
- [ADR 0040](../adr/0040-on-phone-model-router.md) §4 ("no server or cloud fallback") and
  [ADR 0042](../adr/0042-meaning-router-small-embedding-model.md) §4 (the order): meaning, then the phone's model, then
  the cloud reader if allowed, then lists.
- [ADR 0041](../adr/0041-prices-from-drivers.md) §5 stays: no cloud model in prices.
- LLD §3.5 and §8.4, and the privacy text in Settings.

## Appendix: draft ADR, for the gate only

Number to be assigned when accepted; not accepted, not to be built before the gate passes.

### ADR 00xx: An owner may let a cloud model read a chat message their phone cannot place

Status: draft. Amends ADR 0010 and ADR 0040 §4 for chat routing only; amends ADR 0042 §4 (the order); keeps
ADR 0041 §5.

#### Context

Most workers' phones cannot run Qwen3.5-2B. They read intents with the embedding router and word lists
(lite mode), which [the gate's measurement] showed reads [N] points below [model] on Workers AI, and G1b's counts
showed lite misreads [M]% of real messages.

#### Decision

1. An owner may switch on a cloud reader after a consent sheet in their language; it is off by default and lite mode
   stays complete without it.
2. It reads only the owner's own chat messages that the phone's embedding router cannot place, scrubbed of phone
   numbers, UPI ids and addresses, and names only the intent and the words of its slots. It never reads notes, open
   chat, prices, job chats or anything another person wrote.
3. It runs on Workers AI ([model]), with zero retention, no request bodies in logs, a 2.5 s timeout and lite after
   it; offline, it is skipped, never queued.
4. Core reaches it through a `RemoteIntent` port called only from `router/route-chat.ts`, never through `Model`.
5. Every message it read is marked; the mark and Settings withdraw consent in one tap; the server keeps only the
   consent record (notice version, time, withdrawal).

#### Consequences

Owners who say yes are understood more often on a good network; the same message may be read
differently offline. Cloudflare becomes a processor of chat words, and the notice says where they may go. The
claim that nothing an owner types leaves the phone becomes "nothing leaves unless the owner allows it, and never
notes, prices or other people's words".

## Sources

- Measurements: [model-comparison.md](model-comparison.md), [model-comparison-tables.md](model-comparison-tables.md)
  and the per-case data in [router-eval.html](router-eval.html), test split, recomputed 2026-11-03.
- Workers AI [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) (updated 2026-10-20) and
  [data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/) (updated 2026-10-16).
- GPU prices: [E2E Networks L4](https://www.e2enetworks.com/gpus/nvidia-l4),
  [CloudPe](https://www.cloudpe.com/blog/nvidia-l4-gpu-price-in-india/),
  [ZenoCloud](https://zenocloud.io/blog/gpu-cloud-india-vs-us-gpu-clouds/); third-party, to be confirmed.
- [Sarvam API pricing](https://docs.sarvam.ai/api/pricing.md); conflicting snapshots.
- DPDP Rules 2025: [AZB & Partners](https://www.azbpartners.com/bank/update-indias-digital-personal-data-protection-framework-comes-into-effect/),
  [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/),
  [YourStory](https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months);
  check against the Gazette before relying on rule numbers.
