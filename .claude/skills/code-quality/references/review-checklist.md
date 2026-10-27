# Review checklist

Go through this before you call any work done, and use it when reviewing someone else's change. Fix what you
find; if something has to stay, say why in the summary. Report the result item by item.

## Shape

- [ ] Every changed file is under 300 lines and every function under ~50 (`pnpm lint` checks files).
- [ ] Handlers only parse, call and respond; SQL lives in data-access modules; rules live in plain functions.
- [ ] No duplicated logic: a second copy of a query, validation or mapping became one shared function.
- [ ] Names say what the thing is; no `data`, `info`, `tmp`, `handle2`.
- [ ] No magic values: every status, kind, header, route, storage key, tag name, limit and TTL is a named constant
  in the right place (see "Named values" in SKILL.md). `pnpm lint` catches comparisons and repeats; check the rest
  by eye, including values used only once.
- [ ] A value shared by two packages is defined once (protocol or `@gigsync/core`), not copied.
- [ ] No dead code, commented-out code, unused exports, bare `console.log`, or `TODO` without a milestone.

## Correctness

- [ ] Every input is parsed with a schema from `@gigsync/protocol` (or a type guard); no `as` casts on outside data.
- [ ] No `any`; outside JSON is `unknown` until checked.
- [ ] Failure paths return the right status with a safe `{ error }` body.
- [ ] Writes that belong together are in one transaction (`transaction()` on Postgres, `db.batch` on D1): a sign-up
  must not leave a user without a device.
- [ ] Retried operations are idempotent.
- [ ] Time, ids and expiry use the repo's conventions (ULID ids, seconds vs ISO per database).

## Security

- [ ] New `/v1/*` routes are behind the session middleware and check that the caller owns the resource.
- [ ] Nothing returns message content, phone numbers, keys or tokens; logs carry them only inside `pii()`, and secret keys never.
- [ ] Caller-controlled sizes are capped (body, arrays, `LIMIT`, string length).
- [ ] New config that is secret is a `wrangler secret`, not a `[vars]` entry.

## Data

- [ ] Schema changes are a new numbered migration; no applied migration was edited.
- [ ] Tables are normalized; any denormalized column has a comment saying why.
- [ ] Each hot query has an index; lists have `LIMIT` and cursor paging.
- [ ] Values are bound, never interpolated.

## Performance

- [ ] No remote call (Postgres, D1, `fetch`, DO RPC) awaited inside a loop; independent awaits use `Promise.all`.
- [ ] Per-request CPU stays small (free plan: 10 ms); heavy work moved to cron, queue or alarm.
- [ ] Any new dependency runs on Workers and is justified.

## App

- [ ] UI components only render; logic is in `packages/core` or `src/adapters`.
- [ ] Dev-only behaviour is behind `import.meta.env.DEV` and absent from a release build.

## Tests and checks

- [ ] Tests cover the happy path, bad input, and the auth or ownership failure for each new route or DO method.
- [ ] `pnpm lint` (Biome, file size, magic strings), `pnpm build`, `pnpm build:workers`, `pnpm typecheck` and
  `pnpm test` pass.
