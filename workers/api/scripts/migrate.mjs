// Applies the directory's Postgres migrations in order, each once, each in its own transaction. Runs over the
// direct (unpooled) connection: PgBouncer's transaction mode drops session state that DDL and the lock rely on.
// CLI: `pnpm --filter @gigsync/worker-api db:migrate` (reads DATABASE_URL_UNPOOLED); tests import migrate().
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../infra/postgres/directory");
const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const URL_VAR = "DATABASE_URL_UNPOOLED";
/** Advisory lock held while migrating, so two deploys never apply the same file at once. Any fixed number works. */
const MIGRATION_LOCK = 13_0001;

/** Applies every migration not yet recorded in schema_migrations and returns the names it applied. */
export async function migrate(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    const pending = (await readdir(MIGRATIONS_DIR)).filter((f) => MIGRATION_FILE.test(f) && !done.has(f)).sort();
    // In sequence on purpose: each migration may depend on the one before it.
    for (const name of pending) await applyOne(client, name);
    return pending;
  } finally {
    await client.end(); // ending the session releases the advisory lock
  }
}

async function applyOne(client, name) {
  const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env[URL_VAR];
  if (!url) {
    console.error(`${URL_VAR} is not set. Run \`neon env pull\` in the repo root, or set it in CI.`);
    process.exit(1);
  }
  const applied = await migrate(url);
  console.log(applied.length ? `Applied ${applied.join(", ")}` : "Directory schema is up to date.");
}
