import { log } from "@gigsync/core/log";
import type { MiddlewareHandler } from "hono";
import { Client } from "pg";
import { type AppEnv, Var } from "../context.js";

/** What data-access functions need: queries on this request's connection. A `pg` Client satisfies it. */
export type Db = Pick<Client, "query">;

/**
 * Connects, runs `use`, and always closes. pg needs an error listener (without one a socket error is an unhandled
 * rejection); closing always cancels the Workers socket's read loop, so errors once closing has begun are dropped.
 */
export async function withDirectory<T>(
  connectionString: string,
  requestId: string | undefined,
  use: (db: Db) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  let closing = false;
  client.on("error", (err) => {
    if (!closing) log.warn("directory connection error", { requestId, error: err.name, message: err.message });
  });
  await client.connect();
  try {
    return await use(client);
  } finally {
    closing = true;
    await client.end();
  }
}

/**
 * One connection per request through Hyperdrive, which keeps the real connections to Postgres pooled near the
 * database. Closed before the response returns rather than in waitUntil, so it also works where there is no
 * execution context (tests calling app.request).
 */
export const openDirectory: MiddlewareHandler<AppEnv> = (c, next) =>
  withDirectory(c.env.DIRECTORY.connectionString, c.get(Var.requestId), (db) => {
    c.set(Var.db, db);
    return next();
  });

/** Runs `work` in one transaction: every write in it lands, or none do. */
export async function transaction<T>(db: Db, work: () => Promise<T>): Promise<T> {
  await db.query("BEGIN");
  try {
    const out = await work();
    await db.query("COMMIT");
    return out;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
