import { monitorEventLoopDelay } from "node:perf_hooks";
import pg from "pg";

/**
 * What else to watch while a step runs: this machine (a load generator that is itself overloaded measures nothing
 * but itself) and, when given a connection string, the database's connections. The database is only read.
 */

const NS_PER_MS = 1_000_000;
const P99 = 99;
const MS_PER_S = 1000;
const PERCENT = 100;

export interface Machine {
  /** The generator's event loop delay, p99 ms: above ~50 the timings include our own queueing. */
  loopP99Ms: number;
  /** This process's CPU use over the step, as a share of one core. */
  cpuPercent: number;
}

export function watchMachine(): () => Machine {
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  const cpu = process.cpuUsage();
  const started = performance.now();
  return () => {
    loop.disable();
    const used = process.cpuUsage(cpu);
    const wallUs = (performance.now() - started) * MS_PER_S;
    return {
      loopP99Ms: Math.round(loop.percentile(P99) / NS_PER_MS),
      cpuPercent: Math.round((PERCENT * (used.user + used.system)) / wallUs),
    };
  };
}

export interface DbSample {
  at: number;
  total: number;
  active: number;
  /** Transactions committed or rolled back so far: each statement outside BEGIN is one, so a near count of them. */
  xacts: number;
}

const CONNECTIONS_SQL = `SELECT count(*)::int AS total, count(*) FILTER (WHERE state = 'active')::int AS active,
  (SELECT (xact_commit + xact_rollback)::float8 FROM pg_stat_database WHERE datname = current_database()) AS xacts
  FROM pg_stat_activity WHERE datname = current_database()`;
const MAX_CONNECTIONS_SQL = "SELECT current_setting('max_connections')::int AS max";
const DB_EVERY_MS = 5_000;

export interface DbWatch {
  max: number;
  stop: () => Promise<DbSample[]>;
}

/** Nothing watched: the database could not be reached, and the step runs without its counts. */
const UNWATCHED: DbWatch = { max: 0, stop: async () => [] };

/**
 * Samples the database's connections every DB_EVERY_MS on its own connection; returns the stop. A dropped network
 * (this machine's DNS fails now and then) loses samples, never the run.
 */
export async function watchDb(url: string, stepStart: number): Promise<DbWatch> {
  const client = new pg.Client({ connectionString: url });
  client.on("error", (err) => console.error("db watch:", err.message));
  try {
    await client.connect();
  } catch (err) {
    console.error("db watch: not connected:", (err as Error).message);
    return UNWATCHED;
  }
  const max = (await client.query<{ max: number }>(MAX_CONNECTIONS_SQL).catch(() => undefined))?.rows[0]?.max ?? 0;
  const samples: DbSample[] = [];
  const sample = async () => {
    const row = (await client.query<Omit<DbSample, "at">>(CONNECTIONS_SQL)).rows[0];
    if (row) samples.push({ at: Math.round(performance.now() - stepStart), ...row });
  };
  await sample().catch(() => undefined);
  const timer = setInterval(() => void sample().catch(() => undefined), DB_EVERY_MS);
  return {
    max,
    stop: async () => {
      clearInterval(timer);
      await sample().catch(() => undefined);
      await client.end().catch(() => undefined);
      return samples;
    },
  };
}
