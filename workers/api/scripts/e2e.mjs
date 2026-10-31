// Runs `wrangler dev` for the UI tests (tests/ui) against a local Postgres database of their own, never Neon: test
// jobs would otherwise become the market prices real users see (ADR 0039 §1). The database is wiped and migrated on
// every start, so a run begins empty and each spec makes its own data. Its own port, origin, state folder and
// inspector, so it runs beside `pnpm dev:workers` (Neon) without either touching the other.
// The server is the same throwaway Postgres the API's unit tests use (workers/api/test/database.mjs), in a separate
// database, so a `vitest run` in the middle of a UI run cannot wipe it.
import { spawn } from "node:child_process";
import { Client } from "pg";
import { migrate } from "./migrate.mjs";

const SERVER_URL = process.env.E2E_POSTGRES_URL ?? "postgres://postgres:postgres@localhost:54329/postgres";
const DATABASE = "gigsync_e2e";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const PORT = process.env.E2E_API_PORT ?? "8788";
const INSPECTOR_PORT = "9230";
const APP_ORIGIN = process.env.E2E_APP_ORIGIN ?? "http://localhost:5174";
const STATE_DIR = ".wrangler/e2e-state";

const server = new URL(SERVER_URL);
if (!LOCAL_HOSTS.has(server.hostname))
  throw new Error("E2E_POSTGRES_URL must be a local throwaway Postgres: it is wiped");
const databaseUrl = Object.assign(new URL(SERVER_URL), { pathname: `/${DATABASE}` }).toString();

// `--reset-jobs`: run by the UI tests' global setup before every run, while this server may already be up. Job
// records are what market ranges are made of (ADR 0039 §1), so jobs left by an earlier run would move the ranges
// a spec expects. Everything else (people, cards, mailboxes) is per run already.
if (process.argv.includes("--reset-jobs")) {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  await db.query("TRUNCATE job_payments, job_records, job_submissions");
  await db.end();
  process.exit(0);
}

const admin = new Client({ connectionString: SERVER_URL });
try {
  await admin.connect();
} catch (err) {
  console.error(`No Postgres on ${server.host} (${err.message}). See workers/api/test/database.mjs to start one.`);
  process.exit(1);
}
await admin.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${DATABASE}`);
await admin.end();
await migrate(databaseUrl);

process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DIRECTORY = databaseUrl;
const args = ["dev", "--port", PORT, "--inspector-port", INSPECTOR_PORT, "--persist-to", STATE_DIR];
// Fixture quotes: the tests never search the web, and their ranges do not move with it.
args.push("--var", `ALLOWED_ORIGINS:${APP_ORIGIN}`, "--var", "ESTIMATE_SOURCE:fixture");
const wrangler = spawn("wrangler", args, { stdio: "inherit" });
wrangler.on("exit", (code) => process.exit(code ?? 1));
