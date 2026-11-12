// Load-tests the app end to end: simulated phones sign in, list cards, find, ask, answer and sign through the API,
// checking their mailboxes every two seconds as the app does, and (with --corpus) asking the model what their side
// asked in a production run. Each step holds that many people at once for its length.
//
// Only against the local API (`pnpm dev:workers`) on a database the owner agreed to, unless --allow-remote, which
// needs the owner's yes for the steps and length (README.md).
//
//   pnpm --filter @gigsync/load-tests load:app -- --users 10,25,50 --seconds 180 [--corpus <model-calls.jsonl>]
//
// Options: --api (http://localhost:8787), --users, --seconds (180), --ramp seconds (30), --worker-share (0.3),
// --think-ms between a person's model calls (6000), --model-max-users above which the model is left out (50), --db-env KEY in .env.local to watch connections, --out dir.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { readEnvFile, requireKeys } from "../lib/secrets.js";
import { loadCorpus } from "../model/corpus.js";
import { runStep } from "./step.js";
import { printStep, summarise } from "./summary.js";
import { watchDb, watchMachine } from "./watch.js";

const REPO = resolve(import.meta.dirname, "../../..");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Between steps, so the next starts with no one left polling. */
const SETTLE_MS = 10_000;

const { values } = parseArgs({
  options: {
    api: { type: "string", default: "http://localhost:8787" },
    users: { type: "string", default: "10,25,50" },
    seconds: { type: "string", default: "180" },
    ramp: { type: "string", default: "30" },
    "worker-share": { type: "string", default: "0.3" },
    "think-ms": { type: "string", default: "6000" },
    corpus: { type: "string" },
    "db-env": { type: "string" },
    "model-max-users": { type: "string", default: "50" },
    "allow-remote": { type: "boolean", default: false },
    out: { type: "string" },
  },
});
const base = values.api;
if (!LOCAL_HOSTS.has(new URL(base).hostname) && !values["allow-remote"])
  throw new Error(`${new URL(base).host} is not local: pass --allow-remote only with the owner's yes`);

const { DEV_OTP: code } = requireKeys(readEnvFile(join(REPO, "workers/api/.dev.vars")), ["DEV_OTP"]);
const dbUrl = values["db-env"]
  ? requireKeys(readEnvFile(join(REPO, ".env.local")), [values["db-env"]])[values["db-env"]]
  : undefined;
const corpus = values.corpus ? loadCorpus(values.corpus) : undefined;
const seconds = Number(values.seconds);
const modelMaxUsers = Number(values["model-max-users"]);
const out = values.out ?? join(import.meta.dirname, "../runs", `app-${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(out, { recursive: true });
console.log(`API ${new URL(base).host}; users ${values.users} x ${seconds}s; model ${corpus ? "on" : "off"}`);

const summaries = [];
for (const users of values.users.split(",").map(Number)) {
  const machine = watchMachine();
  const db = dbUrl ? await watchDb(dbUrl, performance.now()) : undefined;
  const result = await runStep({
    base,
    code,
    users,
    seconds,
    rampS: Number(values.ramp),
    workerShare: Number(values["worker-share"]),
    thinkMs: Number(values["think-ms"]),
    ...(corpus && users <= modelMaxUsers ? { corpus } : {}),
  });
  const dbSamples = db ? { max: db.max, samples: await db.stop() } : undefined;
  writeFileSync(join(out, `step-${users}.json`), JSON.stringify({ ...result, db: dbSamples }));
  const summary = { ...summarise(users, seconds, result, machine(), dbSamples), model: users <= modelMaxUsers };
  summaries.push(summary);
  printStep(summary);
  await new Promise((r) => setTimeout(r, SETTLE_MS));
}
writeFileSync(join(out, "summary.json"), JSON.stringify(summaries, null, 2));
console.log(`\nsamples and summary in ${out}`);
