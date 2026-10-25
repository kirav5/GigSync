# ADR 0001: One TypeScript codebase in Capacitor for Android, iPhone and Mac

Date: 2026-10-21. Status: accepted.

## Decision

The app is written once in TypeScript (React UI, `@gigsync/core` agent) and shipped through Capacitor. Native
Kotlin and Swift code is limited to plugins behind the interfaces in `packages/core/src/ports.ts`.

## Why

- Android first for India, iPhone and Mac next, from the same code: about 8–10 developer-weeks to add Apple
  instead of 4–5 months for a second native app.
- The web app (collab-market) and the Swift app's model code can both be reused: the first in the UI, the
  second inside the iOS plugins.
- Hiring: TypeScript is the easiest skill to find.

## Consequences

- The agent core must never import browser, Node or Capacitor APIs; it runs in Node tests and would move to
  React Native untouched if WebView performance on 4 GB phones proves too low (validate in month one).
- Every native capability (keys, SQLCipher, model, push, nearby) is a plugin we write or vet.
- The background responder on Android is Kotlin and re-implements the policy rules; `vectors/policy.json`
  keeps it identical to the TypeScript engine.
