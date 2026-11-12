// What Cloudflare and the database saw during a load test, read only.
//
//   jiti monitor.ts db --env DATABASE_URL_UNPOOLED --out runs/db.jsonl   # samples Postgres's stats until stopped
//   jiti monitor.ts cloudflare --from <ISO> --to <ISO> --out runs/cf.json  # per-minute analytics for that window
//
// `db` reads the connection string from .env.local and samples pg_stat_activity and pg_stat_database every
// --every seconds (10). `cloudflare` needs CLOUDFLARE_API_TOKEN (wrangler's own login token works) and reads, per
// minute: requests and statuses at the edge for the model's and the API's hosts, with the origin's average time;
// and the deployed API Worker's invocations, errors and CPU time.
import { appendFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { readEnvFile, requireKeys } from "./lib/secrets.js";

const REPO = resolve(import.meta.dirname, "../..");
const ACCOUNT = "41a60a7a0b165b7d08b36339c7afeb9e";
const ZONE = "804aadc8b771fc20cbb1ecc7506519b2";
const HOSTS = ["model.gigsync.network", "api.gigsync.network"] as const;
const API_SCRIPT = "gigsync-api";
const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const MS_PER_S = 1000;
const Mode = { db: "db", cloudflare: "cloudflare" } as const;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string", default: "DATABASE_URL_UNPOOLED" },
    every: { type: "string", default: "10" },
    from: { type: "string" },
    to: { type: "string" },
    out: { type: "string" },
  },
});

/** Cumulative counters and current connections; differences between samples are the load. */
const DB_SQL = `SELECT now() AS at,
  (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
  (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active,
  (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock') AS waiting_on_locks,
  xact_commit::float8, xact_rollback::float8, blks_read::float8, blks_hit::float8, tup_returned::float8,
  tup_fetched::float8, tup_inserted::float8, tup_updated::float8, tup_deleted::float8, deadlocks::float8
  FROM pg_stat_database WHERE datname = current_database()`;

async function watchDb(): Promise<void> {
  const url = requireKeys(readEnvFile(join(REPO, ".env.local")), [values.env])[values.env];
  const client = new pg.Client({ connectionString: url });
  client.on("error", (err) => console.error("db watch:", err.message));
  await client.connect();
  const out = values.out ?? join(import.meta.dirname, "runs", "db.jsonl");
  const sample = async () => {
    const row = (await client.query(DB_SQL)).rows[0];
    appendFileSync(out, `${JSON.stringify(row)}\n`);
  };
  await sample();
  setInterval(
    () => void sample().catch((err) => console.error("db sample failed:", (err as Error).message)),
    Number(values.every) * MS_PER_S,
  );
}

const EDGE_QUERY = `query($z:String!,$s:Time!,$e:Time!,$h:String!){viewer{zones(filter:{zoneTag:$z}){
  httpRequestsAdaptiveGroups(limit:1000,orderBy:[datetimeMinute_ASC],filter:{datetime_geq:$s,datetime_leq:$e,clientRequestHTTPHost:$h}){
  count avg{originResponseDurationMs} dimensions{datetimeMinute edgeResponseStatus}}}}}`;
const WORKER_QUERY = `query($a:String!,$s:Time!,$e:Time!,$w:String!){viewer{accounts(filter:{accountTag:$a}){
  workersInvocationsAdaptive(limit:1000,orderBy:[datetimeMinute_ASC],filter:{datetime_geq:$s,datetime_leq:$e,scriptName:$w}){
  sum{requests errors subrequests} quantiles{cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99} dimensions{datetimeMinute status}}}}}`;

async function graphql(token: string, query: string, variables: Record<string, string>): Promise<unknown> {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

async function readCloudflare(): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token || !values.from || !values.to) throw new Error("needs CLOUDFLARE_API_TOKEN, --from and --to");
  const window = { s: values.from, e: values.to };
  // One query at a time: the analytics API's rate limit is small and shared with the dashboard.
  const edge: Record<string, unknown> = {};
  for (const h of HOSTS) edge[h] = await graphql(token, EDGE_QUERY, { z: ZONE, h, ...window });
  const worker = await graphql(token, WORKER_QUERY, { a: ACCOUNT, w: API_SCRIPT, ...window });
  const out = values.out ?? join(import.meta.dirname, "runs", "cloudflare.json");
  writeFileSync(out, JSON.stringify({ window, edge, worker }, null, 2));
  console.log(`per-minute analytics for ${window.s} to ${window.e} in ${out}`);
}

if (positionals[0] === Mode.db) await watchDb();
else if (positionals[0] === Mode.cloudflare) await readCloudflare();
else throw new Error(`usage: monitor.ts ${Mode.db} | ${Mode.cloudflare}`);
