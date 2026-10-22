# Data: D1 schema, migrations, queries, Durable Object storage

## Where data goes

| Data                                  | Store                     | Why                                      |
| ------------------------------------- | ------------------------- | ---------------------------------------- |
| Accounts, devices, sessions, consents | D1 `collab-directory`     | Relational, looked up across users       |
| Messages waiting for a device         | Mailbox DO (one per user) | Per-user, write-heavy, expires           |
| Searchable public listings and notes  | D1 `collab-index`         | A rebuildable copy of records on Bluesky |
| Private notes and chats               | The phone only            | Never on the server                      |

Never put message content in D1. Never store a phone number, only its HMAC.

## Normalization

Design to third normal form by default:
- **One fact in one place.** A user's status lives on `users`, not copied onto `devices` and `sessions`.
- **Every non-key column depends on the whole key and nothing but the key.** If a column describes something
  else (a device's owner's locale), it belongs on that other table.
- **No lists in a column.** Repeated values become rows in a child table (`devices` per user, `consents` per
  purpose), many-to-many becomes a junction table with a composite primary key.
- **Foreign keys are declared** with `REFERENCES`, and every child table indexes its foreign key.
- **Enumerations** are `TEXT` with the allowed values in a comment and validated by the zod schema; add a `CHECK`
  constraint when a wrong value would corrupt behaviour.

Denormalize only for a measured, hot read path, and write the reason in a SQL comment next to the column. The
index database is a deliberate exception: a listing row keeps the full signed event (`event`) plus extracted
columns for filtering, because it is a disposable copy rebuilt from the source.

## Conventions in this repo

- Primary keys are prefixed ULIDs stored as `TEXT`: `usr_…`, `dev_…`, `ses_…`, `msg_…`. They sort by time.
- Every directory row carries `user_id`, so the database can be split by user later.
- Timestamps: the directory uses ISO 8601 `TEXT`; the mailbox and index use `INTEGER` epoch seconds. Stay
  consistent with the database you are in; never mix both in one table.
- Soft delete with `revoked_at` / `withdrawn_at` where history matters (devices, sessions, consents); hard delete
  where it must disappear (expired envelopes, user deletion under the DPDP Act).
- Column names are `snake_case`; tables are plural nouns.

## Migrations (D1)

- New file `infra/wrangler/d1/<db>/NNNN_<what>.sql`, next number in sequence. CI applies them with
  `wrangler d1 migrations apply --remote` before deploying code.
- Never edit or renumber a migration that has run anywhere. Fix forward with a new one.
- Make each step safe for the code that is still running: add a column or table first, deploy code that writes it,
  backfill, then make it required or drop the old one in a later migration.
- SQLite cannot drop most constraints in place; changing a constraint means create new table, copy, drop, rename,
  in one migration.
- Test migrations through `applyD1Migrations` in the Worker's tests, which use the same files.

## Queries

- Bind every value. Build dynamic SQL only from fixed fragments (column names chosen in code), never from input.
- Select named columns, never `SELECT *` in application code.
- Add an index for each hot `WHERE` / `JOIN` / `ORDER BY` combination; put the equality columns first
  (`devices (user_id, revoked_at)` serves "active devices of a user").
- `LIMIT` every list and page with a cursor on the primary key (`WHERE msg_id > ? ORDER BY msg_id LIMIT ?`), not
  `OFFSET`.
- Writes that must succeed together go in one `db.batch([...])`, which runs as a transaction.
- D1 allows at most 100 bound parameters per statement; chunk `IN (...)` lists.
- Type results: `.first<{ user_id: UserId }>()`, `.all<DeviceRow>()`.

## Durable Object storage

- One object per natural key (`idFromName(userId)`), so load spreads across many small objects. A single global
  object is only acceptable for a single shared stream (the index's Jetstream hub).
- Create tables in the constructor with `CREATE TABLE IF NOT EXISTS`. For any later change to an existing table,
  keep a schema version (`PRAGMA user_version`) and apply numbered steps in order.
- Validate RPC inputs inside the object as well (the Mailbox re-parses the envelope); the object is a boundary.
- Use alarms for expiry and cleanup, never a sweep over all objects.
- Make writes idempotent where retries happen (the Mailbox's `seen` table guards duplicate deliveries).
