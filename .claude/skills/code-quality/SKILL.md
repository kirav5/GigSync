---
name: code-quality
description: Code quality standards for all of collabai.network. Load BEFORE writing, changing or reviewing any code — workers/ (Hono API, Durable Objects, index), packages/protocol, packages/core, apps/mobile, plugins/, infra/wrangler (D1 migrations, SQL), wrangler.toml, scripts/ and CI workflows — and when designing tables, routes or data flows. Covers named constants (no magic strings or numbers), structure, file size limits, validation, errors, logging, security, D1 schema and queries, Durable Objects, performance on Workers, app code, and tests.
---

# Code quality for collabai.network

Write code the way a senior engineer would ship it: small focused modules, named values, validated inputs,
normalized data, no dead code, tested. These rules apply to every package and are checked in review and partly in
CI (`pnpm lint`). When a rule and a request conflict, say so instead of quietly breaking the rule.

**Order of work:** load this skill before the first edit, not after; then, before calling anything done, go through
`references/review-checklist.md` item by item and report the result.

Read the reference that matches the work before you write code:

- Tables, migrations, SQL, Durable Object storage → `references/data.md`
- Before you finish, and when reviewing someone else's change → `references/review-checklist.md`

## The stack

| Piece             | Where                                     | Notes                                                    |
| ----------------- | ----------------------------------------- | -------------------------------------------------------- |
| API               | `workers/api` (Hono on Workers)           | Routes, auth middleware, CORS; re-exports the Mailbox DO |
| Mailbox           | `workers/mailbox` (Durable Object/user)   | Own SQLite; expiry by alarm                              |
| Search index      | `workers/index` (Worker + D1 + IndexHub)  | Fed by Jetstream; D1 is a rebuildable copy               |
| Schemas           | `packages/protocol` (zod)                 | The only place schemas live                              |
| Agent logic       | `packages/core`                           | Plain TS, no platform APIs; also the shared logger and HTTP names |
| App               | `apps/mobile` (React + Capacitor)         | UI and adapters; platform APIs only in `src/adapters`    |
| Directory DB      | D1 `collab-directory`                     | Migrations in `infra/wrangler/d1/directory`              |

## Hard rules

1. **Files stay under 300 lines.** `pnpm lint` fails at 300 (`scripts/check-file-size.mjs`). Split by
   responsibility once a file passes ~250, not by cutting it in half. Functions stay under ~50 lines.
2. **Schemas live in `packages/protocol` and nowhere else.** Add or change the zod schema there first, then use it.
3. **Validate every input at the boundary** with `Schema.safeParse(...)`. Never trust a request body, query string,
   header, queue message or RPC argument through an `as` cast.
4. **Never return message content, phone numbers, keys or tokens, and log them only through `pii()`.** Use the
   logger in `@collab/core/log`: a `pii()` value prints locally (`ENVIRONMENT=local`, `LOG_PII=true`) and as
   `[redacted]` everywhere else. Never log a private value bare, in errors or anywhere. Secret keys
   (`PHONE_HMAC_KEY`, private keys) are never logged, not even through `pii()`.
5. **No magic strings or numbers.** A value that carries meaning gets a name (see "Named values" below). `pnpm lint`
   fails on a string compared with `===`/`!==` or used as a `case`, and on any string repeated 3+ times in a file.
6. **No `any`.** Use the branded ids (`UserId`, `DeviceId`, `MessageId`) from `@collab/protocol`, `unknown` plus
   parsing for outside data, and real D1 row types.
7. **No dead code.** No commented-out code, unused exports, bare `console.log` (use `log`), or speculative options.
   `TODO` only with a milestone, as the repo does: `// TODO(M2): verify sig against the directory key.`
8. **SQL values are always bound** (`prepare(...).bind(...)`), never interpolated into the string.
9. **Every schema change is a new numbered migration.** Never edit one that has been applied.
10. **Secrets via `wrangler secret put`**, local copies in `.dev.vars` (gitignored). `[vars]` only for public config.
11. **Tests for every route and DO method you add:** the happy path, bad input, and the auth or ownership failure.

## Named values

Every fixed value that means something has exactly one definition, and code refers to it by name.

| Kind of value                                                        | Where it lives                                             | Shape                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Protocol values shared by phone and server (statuses, kinds, topics) | `packages/protocol`, as a zod enum                         | `Topic.enum.location`                    |
| HTTP methods, header names, content types                            | `@collab/core/http`                                        | `HttpMethod.post`, `Header.authorization` |
| Log levels and logger settings                                       | `@collab/core/log`                                         | `LogLevel.debug`, `LOCAL_ENVIRONMENT`    |
| A package's own names (storage collections, card kinds, routes)      | next to the code that owns them, `as const`                | `Collection.outbox`, `CardKind.answer`   |
| One Worker's names and limits (paths, storage keys, tags, TTLs)      | that Worker's `src/constants.ts` or `context.ts`           | `Path.health`, `StorageKey.cursor`       |
| Error messages returned by an API                                    | one `as const` object per Worker                           | `ApiError.unauthorized`                  |
| Limits, sizes, timeouts                                              | a `const` with the unit in the name or a comment           | `MAX_BODY`, `DEFAULT_LISTING_TTL`        |

- Prefer `as const` objects (or zod enums) over TypeScript `enum`: they work in Node's type stripping and in tests.
- Derive the type from the value: `type Expert = (typeof Expert)[keyof typeof Expert]`, so the two cannot drift.
- Comparing with `typeof x === "string"` is fine; those names are the language's.
- Fine as bare values: `0`, `1`, `-1`, HTTP status codes (`404`), SQL text, user-facing copy written once, CSS class
  names, and regular expressions with a name (`const DID = /^did:.../`).
- When in doubt: if a typo in the value would compile but break behaviour, it needs a name.

## Structure

Keep three layers apart, even inside one Worker:

- **Route handler:** parse and validate the input, call one function, map the result to a response. No SQL and no
  business rules in handlers. A handler longer than ~30 lines is doing too much.
- **Domain logic:** pure functions that take plain data and return plain data. Belongs in `packages/core` when the
  phone also needs it; otherwise in a module next to the Worker. Easy to unit test without a runtime.
- **Data access:** one module per table group (`users.ts`, `devices.ts`, `sessions.ts`) exporting small typed
  functions. SQL lives only here.

When a Worker's `src/index.ts` grows past a handful of routes, split it into `routes/<area>.ts`, each exporting a
`Hono` sub-app mounted with `app.route("/v1/<area>", area)`. Shared middleware (CORS, auth) stays in `index.ts` or a
`middleware/` module. Name files after the thing they hold, lowercase, one concept per file.

Comments say why, not what: the reason for an expiry cap, an ordering rule, a security choice. Match the voice of
the existing code.

## Errors and responses

- Respond with JSON `{ "error": "<short, safe message>" }` and the right status: 400 bad input, 401 no or bad
  session, 403 not yours, 404 missing, 409 conflict, 429 too many, 500 only for the unexpected.
- Never put stack traces, SQL, ids of other users or raw upstream errors in a response.
- Register one `app.onError` that logs a safe summary (route, method, error name and message, never request data)
  and returns a generic 500. Write thrown messages so they are safe to log: name the missing thing, not its value.
- Return early on failure; no deep `if` nesting. Do not catch an error just to rethrow it.

## Logging

- `log.info` / `log.warn` / `log.error` for events worth seeing in production: sign-in results, deliveries, failures
  of anything outside our code. Fields are ids, counts, statuses and timings; anything private goes in `pii()`.
- `log.debug` for detail you only want locally (bodies, inputs, decisions). Debug lines never print in deployments.
- `traced("area.name", fn)` around the important async functions, not every helper. It logs arguments and results at
  debug only, private by default.
- Carry `requestId` in every line inside a request so one request can be followed across the logs.

## Security

- Every `/v1/*` route except `/v1/auth/*` sits behind the session middleware. Check ownership, not just login:
  the API already rejects an envelope whose `from.user` is not the session user; keep that standard.
- CORS comes only from `ALLOWED_ORIGINS`; auth is a bearer token, never a cookie.
- Hash identifiers you only need to match (phone numbers use HMAC with `PHONE_HMAC_KEY`).
- Compare secrets and codes in constant time when the comparison guards access.
- Put limits on everything a caller controls: body size, array length (`.max(500)`), query `LIMIT`, string length.

## App code (`apps/mobile`)

- Components render; logic lives in `packages/core` (shared with the phone's background code) or `src/adapters`.
- Platform APIs (Capacitor, `fetch`, storage) only in `src/adapters`, behind the interfaces in `packages/core/src/ports.ts`.
- Use the core's named values (`CardKind`, `Collection`, `LogLevel`) instead of repeating their strings in the UI.
- Dev-only code (Ollama, verbose logs) is gated on `import.meta.env.DEV` so release builds leave it out.

## Performance on Workers

- The free plan allows 10 ms of CPU per request. Keep crypto, JSON work and loops per request small; move heavy
  work to a cron, queue or Durable Object alarm.
- Run independent awaits together with `Promise.all`. Never `await` inside a loop over remote calls.
- D1 is remote: one round trip per statement. Use `db.batch([...])` for several statements, `IN (...)` instead of a
  loop of lookups. Durable Object SQLite is local and synchronous, so a loop of `sql.exec` there is fine.
- Select only the columns you use, always `LIMIT` lists, and make sure an index serves each hot query.
- Use Web Platform APIs (`crypto.subtle`, `fetch`, `Response.json`) before adding a dependency. A new dependency
  needs a reason: it must run on Workers and be worth its bundle size.

## Workflow

1. Schema in `packages/protocol` → build it (`pnpm --filter @collab/protocol build`).
2. Migration in `infra/wrangler/d1/<db>/` if the data model changes (see `references/data.md`).
3. Data-access functions, then domain logic, then the route.
4. Tests in the Worker's `test/` folder (`@cloudflare/vitest-pool-workers`, `applyD1Migrations`).
5. `pnpm lint && pnpm typecheck && pnpm test` must pass. Run `pnpm lint` before **every** commit, including
   docs-only ones: Biome formats Markdown (tables, lists) and the file-size check reads every tracked file. The
   committed hooks in `.githooks/` (installed by `pnpm install` via `prepare`) run lint on commit and typecheck on
   push; never bypass them with `--no-verify` to get a red commit through.
6. **Never push to `main`.** Branch, PR, green CI, squash-merge; every commit signed off (`git commit -s`). The
   full procedure is the `git-workflow` skill; load it before any commit, push or merge.
6. Go through `references/review-checklist.md` and fix what it finds before calling the work done.
