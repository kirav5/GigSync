// Test helpers shared by the index tests.
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { DB } from "../src/store.ts";

/** D1's interface over node:sqlite, with the real schema. */
export function memoryDB(): DB {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return {
    prepare(sql: string) {
      const st = db.prepare(sql);
      return {
        bind: (...args: unknown[]) => {
          const values = args as SQLInputValue[];
          return {
            all: async <T>() => ({ results: st.all(...values) as T[] }),
            run: async () => st.run(...values),
            first: async <T>() => (st.get(...values) as T | undefined) ?? null,
          };
        },
      };
    },
  };
}

/** The value, or a failed test if it is missing. */
export function must<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) throw new Error(`expected a ${what}`);
  return value;
}
