# ADR 0052: GigSync's own model, on a Mac Studio, for every owner by default

Date: 2026-11-04. Status: accepted by the founders. Amends [ADR 0010](0010-no-cloud-model-in-gigsync.md) (no cloud
model) and [ADR 0040](0040-on-phone-model-router.md) (chat text stays on the phone). Builds the reader the cloud-model
analysis ([cloud-model-for-lite-phones.md](../gigsync/cloud-model-for-lite-phones.md), PR #26) planned, on GigSync's
own computer instead of Workers AI.

## Context

Most pilot workers' phones cannot run a model, so they read chat in lite mode: the embedding router, then word lists.
The analysis in PR #26 measured lite at 62% on the intent eval's test split, the phone's 2B chain at 67%, and never
measured anything larger. It set a gate for any reader off the phone: at least 8 points over lite, worse in no language.

On 2026-11-04 the founders ran the eval (`pnpm eval:intent --split test`, 1,002 cases) against
`qwen3:30b-a3b-instruct-2507-q4_K_M` (30.5B parameters, about 3B active per token) in Ollama on a Mac Studio:

| Reader                         | All | en  | hi  | kn  | Hinglish | Kanglish |
| ------------------------------ | --- | --- | --- | --- | -------- | -------- |
| Lite (every phone today)       | 62% | 77% | 63% | 58% | 54%      | 57%      |
| Lite, then the 30B, then lists | 90% | 96% | 94% | 92% | 97%      | 68%      |

The model answered 975 cases; median 283 ms, 90th percentile 1.0 s, slowest 2.5 s, no timeouts at the router's
5 s limit. One client asked at a time: this says nothing yet about many owners at once.

## Decision

1. **GigSync's model.** A route on the API, `POST /v1/model/generate`, takes the prompt the phone would give its own
   engine (core's `GenerateOptions`: tokens, temperature, JSON, a reply schema) and asks Ollama on the Mac Studio for
   `MODEL_NAME`, with no hidden reasoning (`think: false`). The model is the server's; the caller cannot choose it.
   Behind the owner's session, at most 120 calls a minute per owner, prompts up to 16,000 characters. What was said
   is never logged or kept: the route logs only how long the model took and whether it answered.
2. **Reaching the Mac Studio.** In the pilot through a Cloudflare Tunnel to the Studio's Ollama, behind Cloudflare
   Access with a service token (`MODEL_ACCESS_ID`, `MODEL_ACCESS_SECRET`); Ollama itself has no password and is never
   opened to the internet. Locally, `MODEL_ORIGIN` is the Studio's address on the LAN. With `MODEL_ORIGIN` unset the
   route answers 503 and nothing else changes.
3. **On for every owner by default.** The founders chose this over asking each owner (2026-11-04). Settings' Auto, the
   default, now asks GigSync's model first; when it gives nothing (down, not set up, slower than 4 s), the phone's own
   model if it is ready, otherwise lite mode. After a failure the phone stops asking for a minute, so a Studio that is
   off does not slow every message. An owner who chose On-device or Lite mode keeps it, and either choice keeps every
   word on the phone. The Privacy page says who reads what the owner writes and how to switch it off.
4. **Secret answers stay on the phone.** While a secret question is open (a worker's lowest rate), its answer goes only
   to a model on the phone, never GigSync's: the same rule that already keeps it from a company's speech recognizer.

## Consequences

- Owners' words leave their phones for GigSync's computer, which ADR 0010 ruled out "even with consent". Consent here
  rests on the Privacy page and Settings, not a question each owner answers: weaker than DPDP's specific, informed
  consent and than the opt-in PR #26 planned. Revisit before the pilot grows past its first owners, and before the
  union partner signs off.
- A budget or price said in free text ("a maid under ₹5,000") reaches GigSync's model before the budget question
  comes up. It is not kept, and workers never see it, but "it stays on this phone" is true only of what the phone
  stores and of the secret answers.
- Kanglish is still the weakest language (68%). Better than lite, but one message in three is misread.
- One machine serves everyone: power, the internet line, a macOS update or a reboot take the model away. Phones fall
  back to their own model or lite mode, so the chat gets less sharp, not broken. A load test at about three times the
  expected peak is still to run before the pilot's 500 owners rely on it.
- The model is open-weight and self-hosted in India: no third party reads the words, and GigSync still works with the
  Studio off, which keeps the Mozilla fit (no core dependence on a frontier model).
