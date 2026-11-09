import { log } from "@gigsync/core/log";
import type { MiddlewareHandler } from "hono";
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { type AppEnv, Var } from "../context.js";

/** What data-access functions need: queries on this request's connection. A `pg` Client satisfies it. */
export interface Db {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

/** An open connection: queries, and the close that ends it. */
export interface Connection extends Db {
  end(): Promise<void>;
}

/** A `Db` that connects on its first query, and the close that ends the connection only if one was opened. */
export interface LazyDb {
  db: Db;
  close(): Promise<void>;
}

/**
 * Puts off `connect` until the first query, so a request that never asks the directory (the inbox poll with a
 * remembered session) costs no connection at all. Queries started together share the one connection, and a
 * transaction works as before: every statement runs on that same connection.
 */
export function lazyDb(connect: () => Promise<Connection>): LazyDb {
  let opening: Promise<Connection> | undefined;
  return {
    db: {
      async query<Row extends QueryResultRow>(text: string, values?: unknown[]) {
        opening ??= connect();
        return (await opening).query<Row>(text, values);
      },
    },
    async close() {
      // A connection that failed to open has nothing to end; its error already reached the query that asked for it.
      const connection = await opening?.catch(() => undefined);
      await connection?.end();
    },
  };
}

/**
 * Connects to the directory. pg needs an error listener (without one a socket error is an unhandled rejection);
 * closing always cancels the Workers socket's read loop, so errors once closing has begun are dropped.
 */
async function connectDirectory(connectionString: string, requestId: string | undefined): Promise<Connection> {
  const client = new Client({ connectionString });
  let closing = false;
  client.on("error", (err) => {
    if (!closing) log.warn("directory connection error", { requestId, error: err.name, message: err.message });
  });
  await client.connect();
  return {
    query: (text, values) => client.query(text, values),
    end() {
      closing = true;
      return client.end();
    },
  };
}

/** Runs `use` with a directory connection that opens on its first query, and always closes one that opened. */
export async function withDirectory<T>(
  connectionString: string,
  requestId: string | undefined,
  use: (db: Db) => Promise<T>,
): Promise<T> {
  const directory = lazyDb(() => connectDirectory(connectionString, requestId));
  try {
    return await use(directory.db);
  } finally {
    await directory.close();
  }
}

/**
 * At most one connection per request through Hyperdrive, which keeps the real connections to Postgres pooled near the
 * database; none for a request that never queries. Closed before the response returns rather than in waitUntil, so it
 * also works where there is no execution context (tests calling app.request).
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
