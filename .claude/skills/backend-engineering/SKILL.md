---
name: backend-engineering
description: Senior backend engineering standards for collabai.network. Use whenever writing, changing or reviewing backend code — anything in workers/ (Hono API, Durable Objects, index), packages/protocol, packages/core, infra/wrangler (D1 migrations, SQL) or wrangler.toml — and when designing tables, routes or data flows. Covers structure, file size limits, validation, errors, security, D1 schema normalization and queries, Durable Objects, performance on the Workers runtime, and tests.
---

# Backend engineering for collabai.network

Write backend code the way a senior engineer would ship it: small focused modules, validated inputs, normalized
data, no dead code, tested. These rules are checked in review and partly in CI. When a rule and a request
conflict, say so instead of quietly breaking the rule.

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
| Agent logic       | `packages/core`                           | Plain TS, no platform APIs                               |
| Directory DB      | D1 `collab-directory`                     | Migrations in `infra/wrangler/d1/directory`              |

## Hard rules

1. **Files stay under 300 lines.** `pnpm lint` fails at 300 (`scripts/check-file-size.mjs`). Split by
   responsibility once a file passes ~250, not by cutting it in half. Functions stay under ~50 lines.
2. **Schemas live in `packages/protocol` and nowhere else.** Add or change the zod schema there first, then use it.
3. **Validate every input at the boundary** with `Schema.safeParse(...)`. Never trust a request body, query string,
   header, queue message or RPC argument through an `as` cast.
4. **Never log or return message content, phone numbers, keys or tokens.** Not in errors, not in debug lines.
5. **No `any`.** Use the branded ids (`UserId`, `DeviceId`, `MessageId`) from `@collab/protocol`, `unknown` plus
   parsing for outside data, and real D1 row types.
6. **No dead code.** No commented-out code, unused exports, leftover `console.log`, or speculative options.
   `TODO` only with a milestone, as the repo does: `// TODO(M2): verify sig against the directory key.`
7. **SQL values are always bound** (`prepare(...).bind(...)`), never interpolated into the string.
8. **Every schema change is a new numbered migration.** Never edit one that has been applied.
9. **Secrets via `wrangler secret put`**, local copies in `.dev.vars` (gitignored). `[vars]` only for public config.
10. **Tests for every route and DO method you add:** the happy path, bad input, and the auth or ownership failure.

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
- Register one `app.onError` that logs a safe summary (route, status, error name) and returns a generic 500.
- Return early on failure; no deep `if` nesting. Do not catch an error just to rethrow it.

## Security

- Every `/v1/*` route except `/v1/auth/*` sits behind the session middleware. Check ownership, not just login:
  the API already rejects an envelope whose `from.user` is not the session user; keep that standard.
- CORS comes only from `ALLOWED_ORIGINS`; auth is a bearer token, never a cookie.
- Hash identifiers you only need to match (phone numbers use HMAC with `PHONE_HMAC_KEY`).
- Compare secrets and codes in constant time when the comparison guards access.
- Put limits on everything a caller controls: body size, array length (`.max(500)`), query `LIMIT`, string length.

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
5. `pnpm lint && pnpm typecheck && pnpm test` must pass.
6. Go through `references/review-checklist.md` and fix what it finds before calling the work done.
