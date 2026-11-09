import type { QueryResult, QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";
import { type Connection, lazyDb, transaction } from "../src/db/client.js";

const NO_ROWS = { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };

/** A connection that only counts: how often it was opened and ended, and what was asked of it. */
function countingDirectory() {
  const seen = { opened: 0, ended: 0, statements: [] as string[] };
  const connection: Connection = {
    query<Row extends QueryResultRow>(text: string): Promise<QueryResult<Row>> {
      seen.statements.push(text);
      return Promise.resolve(NO_ROWS);
    },
    end() {
      seen.ended += 1;
      return Promise.resolve();
    },
  };
  const connect = () => {
    seen.opened += 1;
    return Promise.resolve(connection);
  };
  return { seen, connect };
}

describe("the request's directory connection", () => {
  it("is never opened, or closed, by a request that asks nothing", async () => {
    const { seen, connect } = countingDirectory();
    await lazyDb(connect).close();
    expect(seen).toEqual({ opened: 0, ended: 0, statements: [] });
  });

  it("opens once for queries started together, and is closed once", async () => {
    const { seen, connect } = countingDirectory();
    const directory = lazyDb(connect);
    await Promise.all([directory.db.query("SELECT 1"), directory.db.query("SELECT 2")]);
    await directory.close();
    expect(seen.opened).toBe(1);
    expect(seen.ended).toBe(1);
  });

  it("carries a whole transaction on the one connection", async () => {
    const { seen, connect } = countingDirectory();
    const directory = lazyDb(connect);
    await transaction(directory.db, () => directory.db.query("UPDATE x"));
    await directory.close();
    expect(seen.opened).toBe(1);
    expect(seen.statements).toEqual(["BEGIN", "UPDATE x", "COMMIT"]);
  });

  it("gives the failure to the query when it cannot open, and has nothing to close", async () => {
    const directory = lazyDb(() => Promise.reject(new Error("no directory")));
    await expect(directory.db.query("SELECT 1")).rejects.toThrow("no directory");
    await expect(directory.close()).resolves.toBeUndefined();
  });
});
