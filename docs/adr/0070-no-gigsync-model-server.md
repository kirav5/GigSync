# 0070: No model server of GigSync's own

Date: 2026-11-21. Status: accepted by the founders. Retires [ADR 0052](0052-gigsync-model-on-a-mac-studio.md)
(GigSync's own model on a Mac Studio). Restores [ADR 0010](0010-no-cloud-model-in-gigsync.md): no model off the phone
reads what owners write.

## Context

ADR 0052 put a 30B model in Ollama on a Mac Studio, reached by the API's `/v1/model` route through a Cloudflare Tunnel,
and made it what answered under Auto. Since then the phone has its own reader (ADR 0065), trained and trimmed to ship in
the app, and no generative model runs on the phone on any platform (2026-11-15). The founders decided on 2026-11-21
that GigSync's code should not carry a model server: one computer behind a tunnel is a single point of failure for every
phone, and it is the only place where what owners type leaves their phone to be read.

## Decision

- The API has no model route: `/v1/model/generate` and `/v1/model/status` are gone, with `MODEL_ORIGIN`, `MODEL_NAME`,
  the Cloudflare Access token (`MODEL_ACCESS_ID`, `MODEL_ACCESS_SECRET`) and the per-user model rate limit.
- The app has no Auto choice: release builds are lite mode, where the phone's reader, the understanding pack, rules and
  templates do every job. Development builds may still name a local model with `VITE_OLLAMA_MODEL`. A choice saved by
  an older app reads as lite.
- Protocol keeps only `ModelPurpose`, which logs every model call by what it was for.
- The offline tools (`pnpm eval:*`, `pnpm reader:data`) still take any Ollama by its address; they run on a developer's
  computer and never in the product.

## Consequences

- Nothing an owner types is read off their phone by a model, and the pilot no longer depends on one computer.
- Messages the phone's reader does not read (Hindi and Kannada in their scripts) go to the word lists, as on a phone
  that could not reach the Mac Studio before; Talk's router and the price questions use their fixed forms.
- The tunnel, the Access application and its service token, and Ollama on the Mac Studio are outside the repository:
  take them down by hand.
