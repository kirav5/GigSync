# Backend review checklist

Go through this before you call backend work done, and use it when reviewing someone else's change. Fix what you
find; if something has to stay, say why in the summary.

## Shape

- [ ] Every changed file is under 300 lines and every function under ~50 (`pnpm lint` checks files).
- [ ] Handlers only parse, call and respond; SQL lives in data-access modules; rules live in plain functions.
- [ ] No duplicated logic: a second copy of a query, validation or mapping became one shared function.
- [ ] Names say what the thing is; no `data`, `info`, `tmp`, `handle2`.
- [ ] No dead code, commented-out code, unused exports, `console.log`, or `TODO` without a milestone.

## Correctness

- [ ] Every input is parsed with a schema from `@collab/protocol`; no `as` casts on outside data.
- [ ] Failure paths return the right status with a safe `{ error }` body.
- [ ] Writes that belong together are in one `db.batch` (a sign-up must not leave a user without a device).
- [ ] Retried operations are idempotent.
- [ ] Time, ids and expiry use the repo's conventions (ULID ids, seconds vs ISO per database).

## Security

- [ ] New `/v1/*` routes are behind the session middleware and check that the caller owns the resource.
- [ ] Nothing logs or returns message content, phone numbers, keys or tokens.
- [ ] Caller-controlled sizes are capped (body, arrays, `LIMIT`, string length).
- [ ] New config that is secret is a `wrangler secret`, not a `[vars]` entry.

## Data

- [ ] Schema changes are a new numbered migration; no applied migration was edited.
- [ ] Tables are normalized; any denormalized column has a comment saying why.
- [ ] Each hot query has an index; lists have `LIMIT` and cursor paging.
- [ ] Values are bound, never interpolated.

## Performance

- [ ] No remote call (`D1`, `fetch`, DO RPC) awaited inside a loop; independent awaits use `Promise.all`.
- [ ] Per-request CPU stays small (free plan: 10 ms); heavy work moved to cron, queue or alarm.
- [ ] Any new dependency runs on Workers and is justified.

## Tests and checks

- [ ] Tests cover the happy path, bad input, and the auth or ownership failure for each new route or DO method.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
