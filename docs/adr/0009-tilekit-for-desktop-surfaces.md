# ADR 0009: Tilekit for GigSync's desktop surfaces, not the phone

Date: 2026-10-25. Status: proposed.

## Context

GigSync is built "with Tilekit": [Tiles](https://tiles.run) is Mozilla-backed, local-first and built on AT Protocol,
and **Tilekit** is how other products embed it. Tilekit is three things in `tilesprivacy/tiles`, dual-licensed MIT OR
Apache-2.0:
- **The Tilekit REST API.** The local Tiles daemon serves it at `http://127.0.0.1:1729/v1/tilekit/`. It covers
  server, agent, session, account and atproto routes, with SSE for prompts.
- **The `tilekit` Rust crate.** It is a Modelfile parser for `FROM`, `SYSTEM`, `PARAMETER`, `MESSAGE` and related
  directives.
- **Agent Plugins.** A plugin is a `plugin.json` plus `skills/<name>/SKILL.md`, installed with `tiles plugin install`.

Tiles runs on Apple Silicon macOS and Linux, and its default model is Gemma 4 12B through llama.cpp. GigSync's worker
is on a 4 GB, ₹10,000 Android phone. Tiles cannot run there.

## Decision

1. **The phone does not depend on Tiles.** It keeps LiteRT-LM or llama.cpp behind the `Model` port (ADR 0001) and
   works with no model at all.
2. **The GigSync Desk runs on Tiles through Tilekit.** The Desk is the union and helpline desk app (Tauri 2).
   - It reads evidence packs without any model.
   - It drafts grievance letters with the Tiles agent on the organiser's own laptop, so a worker's evidence never
     reaches a cloud model.
   - The typed client is `packages/tilekit-client`.
3. **One Modelfile is the source of truth for the persona.**
   - `tiles/gigsync.modelfile` holds the persona, the prompts and the sampling parameters.
   - Tiles runs it directly. The phone build reads `SYSTEM` and `PARAMETER` from the same file and maps `FROM` to an
     on-device model through `tiles/model-map.json`.
4. **GigSync ships a Tiles Agent Plugin** (`tiles/plugin/`) with the grievance and explain skills, so any Tiles user,
   such as a union legal volunteer, can use them.
5. **The eval harness runs through Tilekit.** It runs the on-phone prompt set against desk and phone-class models
   before anything ships to phones.

## Consequences

- We gain local-first drafting for unions, aligned with Tiles' AT Protocol identity and Mozilla's Human-Scale AI
  programme, and we do not write a desktop inference stack ourselves.
- Tilekit is pre-1.0, and its book and code disagree on some methods.
  - The client keeps every route in `routes.ts` and sends a JSON content type on every POST, which Tiles PR #277 will
    require.
  - The Desk should pin a minimum daemon version.
- The daemon's CORS list only admits `tauri://localhost` and `localhost:5173`. A browser-only web desk would need a
  local proxy, so the Desk is a Tauri app.
- If Tiles changes direction, only the Desk and the eval harness are affected. The phone and the protocol are not.
