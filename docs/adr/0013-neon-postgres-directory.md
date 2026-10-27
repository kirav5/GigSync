# ADR 0013: The directory moves from D1 to Neon Postgres, reached through Hyperdrive

Date: 2026-10-25. Status: accepted. Supersedes the directory part of [ADR 0002](0002-cloudflare-backend.md).

## Decision

The directory (users, phone bindings, devices, keys, sessions, consents, sign-in attempts) lives in Lakebase
Postgres on Neon, project `flat-moon-15132317`, branch `production`, region `aws-ap-southeast-1`. The API Worker
reaches it with `node-postgres` (`pg`) through a Cloudflare Hyperdrive binding named `DIRECTORY`, one connection
per `/v1` request. Migrations are plain SQL in `infra/postgres/directory`, applied by
`pnpm --filter @gigsync/worker-api db:migrate` over the direct (unpooled) URL and recorded in `schema_migrations`.

Everything else in ADR 0002 stands: Workers for the APIs, a Durable Object per user for the mailbox, D1 for the
search index (a disposable copy rebuilt from Bluesky), R2 for files.

## Why

- Postgres gives the directory real types (`TIMESTAMPTZ`, `CHECK` on status), transactions that read and write
  in one unit (D1's batch cannot read in the middle), and the full SQL toolset for the reports and joins the
  union, helpline and welfare-board views in the LLD will need.
- Neon branches are instant copies: a migration can be tried on a branch of production before it runs for real,
  and preview environments get their own database.
- Hyperdrive keeps the connections to Neon pooled near the database and caches nothing we did not ask for, so a
  Worker request pays for one short local connection, not a TLS handshake to Singapore.
- `pg` with Hyperdrive is what both Cloudflare and Neon recommend for Workers.

## Consequences

- Two vendors for the backend instead of one. Leaving Neon means pointing Hyperdrive at another Postgres;
  leaving Cloudflare means running the API elsewhere with the same `pg` code.
- The database is in Singapore (`aws-ap-southeast-1`, Neon's closest region to India), not pinned to India. As
  in ADR 0002 this is acceptable: phone numbers are stored only as HMACs and no message content is ever here.
- Before the first deploy: `wrangler hyperdrive create gigsync-directory --connection-string=<direct URL>` and
  paste the id into `workers/api/wrangler.toml`; add `DATABASE_URL_UNPOOLED` as a GitHub Actions secret so the
  deploy workflow can migrate.
- Local dev reads the Neon URL from `.env.local` (`neon env pull`). Tests run against a throwaway local Postgres 18
  (`localhost:54329`, a CI service) that they wipe, never against Neon.
- The free plan scales compute to zero after 5 idle minutes; the first query after that waits a few hundred ms.
