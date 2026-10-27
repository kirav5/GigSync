// The tests' Postgres: a throwaway local server, wiped and migrated before every run (vitest globalSetup). Locally
// `docker run -d --name gigsync-test-db -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:18`; CI runs the same
// image as a service. Refuses anything but a local host, so a real database can never be wiped by mistake.
import { Client } from "pg";
import { migrate } from "../scripts/migrate.mjs";

const DEFAULT_TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:54329/postgres";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

export default async function setup() {
  const { hostname, port } = new URL(TEST_DATABASE_URL);
  if (!LOCAL_HOSTS.has(hostname))
    throw new Error("TEST_DATABASE_URL must be a local throwaway Postgres: tests wipe it");
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(`No test Postgres on ${hostname}:${port} (${err.message}). See workers/api/test/database.mjs.`);
  }
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  } finally {
    await client.end();
  }
  await migrate(TEST_DATABASE_URL);
}
