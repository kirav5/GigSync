// Load-tests the model on GigSync's computer (Ollama on the Mac Studio, through its Cloudflare Tunnel and Access):
// real prompts from a production run, mixed as real traffic is, at rising concurrency. Each step keeps C calls in
// flight for its whole length (a closed loop), so it shows the most the model can answer and what waiting costs.
//
// The model is production: run this only with the owner's yes, for the steps and length agreed (README.md).
//
//   pnpm --filter @gigsync/load-tests load:model -- --corpus <run>/model-calls.jsonl --steps 1,2,4,8 --seconds 60
//
// Options: --steps (default 1,2,4,8,16,32), --seconds per step (60), --timeout ms per call (15000, the API's
// MODEL_TIMEOUT_MS), --stop-errors share at which to stop climbing (0.5), --no-stream, --out dir.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { readEnvFile, requireKeys } from "../lib/secrets.js";
import { loadCorpus } from "./corpus.js";
import type { ModelTarget } from "./ollama.js";
import { baseline, loadedModels, runStep } from "./step.js";
import { printSteps, summarise } from "./summary.js";

const REPO = resolve(import.meta.dirname, "../../..");
const DEV_VARS = join(REPO, "workers/api/.dev.vars");
const DEFAULT_STEPS = "1,2,4,8,16,32";
const DEFAULT_SECONDS = "60";
/** The API's own limit on a model call (workers/api/src/routes/model.ts MODEL_TIMEOUT_MS). */
const DEFAULT_TIMEOUT_MS = "15000";
const DEFAULT_STOP_ERRORS = "0.5";
/** Between steps, so the next starts on an empty queue. */
const SETTLE_MS = 5_000;
const MS_PER_S = 1000;

const { values } = parseArgs({
  options: {
    corpus: { type: "string" },
    steps: { type: "string", default: DEFAULT_STEPS },
    seconds: { type: "string", default: DEFAULT_SECONDS },
    timeout: { type: "string", default: DEFAULT_TIMEOUT_MS },
    "stop-errors": { type: "string", default: DEFAULT_STOP_ERRORS },
    "no-stream": { type: "boolean", default: false },
    out: { type: "string" },
  },
});
if (!values.corpus) throw new Error("--corpus <model-calls.jsonl> is required");

const env = requireKeys(readEnvFile(DEV_VARS), [
  "MODEL_ORIGIN",
  "MODEL_NAME",
  "MODEL_ACCESS_ID",
  "MODEL_ACCESS_SECRET",
]);
const target: ModelTarget = {
  origin: env.MODEL_ORIGIN,
  name: env.MODEL_NAME,
  headers: { "CF-Access-Client-Id": env.MODEL_ACCESS_ID, "CF-Access-Client-Secret": env.MODEL_ACCESS_SECRET },
};
const corpus = loadCorpus(values.corpus);
const steps = values.steps.split(",").map(Number);
const opts = {
  seconds: Number(values.seconds),
  timeoutMs: Number(values.timeout),
  stream: !values["no-stream"],
};
const out =
  values.out ?? join(import.meta.dirname, "../runs", `model-${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(out, { recursive: true });

console.log(`model ${target.name} at ${new URL(target.origin).host}; steps ${steps.join(", ")} x ${opts.seconds}s`);
console.log(
  "mix:",
  [...corpus.weights].map(([p, w]) => `${p} ${(100 * w).toFixed(1)}%`).join(", "),
  `(${[...corpus.calls.values()].flat().length} prompts)`,
);
const network = await baseline(target);
console.log(`network round trip to the tunnel (keep-alive): p50 ${network.p50} ms, p90 ${network.p90} ms`);
const before = await loadedModels(target);
writeFileSync(join(out, "setup.json"), JSON.stringify({ steps, ...opts, network, before }, null, 2));

const summaries = [];
for (const concurrency of steps) {
  const samples = await runStep(target, corpus, { ...opts, concurrency });
  writeFileSync(join(out, `step-${concurrency}.jsonl`), samples.map((s) => JSON.stringify(s)).join("\n"));
  const after = await loadedModels(target);
  const summary = summarise(concurrency, samples, opts.seconds, network.p50 ?? 0, after);
  summaries.push(summary);
  printSteps([summary]);
  if (summary.errorShare >= Number(values["stop-errors"])) {
    console.log(`stopping: ${Math.round(100 * summary.errorShare)}% of calls failed at ${concurrency} at once`);
    break;
  }
  await new Promise((r) => setTimeout(r, SETTLE_MS));
}
writeFileSync(join(out, "summary.json"), JSON.stringify(summaries, null, 2));
console.log(`\nall steps (${Math.round(performance.now() / MS_PER_S)} s):`);
printSteps(summaries);
console.log(`samples and summary in ${out}`);
