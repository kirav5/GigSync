# ADR 0009: One offline model plugin on every platform, not Tiles/Tilekit

Date: 2026-10-25. Status: accepted.

## Context

GigSync must run on a 4 GB, ₹10,000 Android phone, on iPhone and Mac, and in a browser. A union organiser often
works from a shared office PC with only a browser.

We looked at [Tiles](https://tiles.run) and its embedding kit, Tilekit, which is part of
`tilesprivacy/tiles`. It is local-first, Mozilla-backed and built on AT Protocol. Tilekit is:
- a REST API served by a local Tiles daemon on `127.0.0.1:1729`;
- a Modelfile parser written in Rust;
- Agent Plugins.

The Tiles daemon runs only on Apple Silicon macOS and Linux, and its default model is a 12B model. Tiles has no
Android, iPhone or browser runtime, and its daemon's CORS rules block ordinary web origins.

collabai.network (upstream) already has an offline model path that covers every platform GigSync targets:
- `plugins/gigsync-llm` is one Capacitor plugin with `status()` and `generate()`.
  - On Android it runs LiteRT-LM.
  - On iPhone and Mac it runs Apple Foundation Models.
  - On the web it has a slot for an in-browser engine.
- A dev-only Ollama adapter.
- Lite mode (keyword router and templates) when no model is available.

## Decision

1. GigSync uses the inherited plugin, renamed `plugins/gigsync-llm` (`GigSyncLLM`), as its only language model on
   every platform. Behind it:
   - LiteRT-LM on Android;
   - Foundation Models on Apple;
   - Chrome's built-in Gemini Nano on the web (desktop Chrome 138+; not available in phone browsers);
   - Ollama in development only.
2. GigSync does not depend on Tiles or Tilekit. The union desk is the same app in union mode, usually the web build,
   not a separate desktop app.
3. The persona lives in code (`packages/core/src/persona.ts`), shared by every engine, with templates as the no-model
   path.

## Consequences

- One codebase and one model interface serve the web, Android and Apple.
- A union desk needs only a browser.
- The phone and web engines are still stubs. Choosing and measuring a ≤2B model for Android and an in-browser
  engine is G3 work.
- Grievance drafting in union mode uses templates, or whatever small model the device has, instead of a 12B desktop
  model. Drafts will be plainer; organisers edit them.
- If Tiles later ships mobile or web runtimes, it can sit behind the same `Model` port without changing
  `@gigsync/core`.
