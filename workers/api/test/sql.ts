import { env } from "cloudflare:test";
import { withDirectory } from "../src/db/client.js";

/** Runs one statement on the test directory, outside any request, for setting up or checking a test. */
export function sql<Row extends Record<string, unknown>>(text: string): Promise<Row[]> {
  return withDirectory(env.DIRECTORY.connectionString, undefined, async (db) => (await db.query<Row>(text)).rows);
}
