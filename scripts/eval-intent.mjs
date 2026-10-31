// The chat intent eval (ADR 0040 §6): every phrasing in vectors/intents through the word lists, the phone's model
// (Ollama in development) and the chain the app runs, with a generated report in docs/gigsync/intent-eval.md.
// Run with `pnpm eval:intent` (builds core first). Options:
//   --keywords-only   skip the model, for CI without Ollama
//   --limit N         only the first N cases (after --lang)
//   --lang SET        only one set: en, hi, kn, hinglish or kanglish
//   --split HALF      only `dev` (a third, for changing the prompt) or `test` (the rest, for scoring it)
//   --timeout MS      the model router's time limit instead of the phone's, to measure a model slower on this
//                     computer than on its target device without counting its slowness as wrong answers
//   --webllm ID       the phone's own engine instead of Ollama: WebLLM running ID (a build in the plugin's catalog)
//                     in Chromium on this computer's GPU (webllm.mjs)
//   --out FILE        write the report there instead of docs/gigsync/intent-eval.md, even for a partial run
//   --json FILE       also write every case's result, for comparing models (docs/gigsync/model-comparison.md)
// A run with --limit, --lang, --split or --timeout prints its numbers and leaves the report alone. Exits non-zero only when a data file
// is broken or Ollama is not there for a model run, never on a low score.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DataError, loadCases, SETS, Split, splitOf } from "./eval-intent/cases.mjs";
import { core } from "./eval-intent/core.mjs";
import { askOllama, OLLAMA_MODEL, OLLAMA_URL, ollamaReady, remembering } from "./eval-intent/ollama.mjs";
import { report } from "./eval-intent/report.mjs";
import { Router, runAll } from "./eval-intent/run.mjs";
import { accuracy, groupBy, percent } from "./eval-intent/score.mjs";
import { openWebLlm } from "./eval-intent/webllm.mjs";

const REPORT = new URL("../docs/gigsync/intent-eval.md", import.meta.url);
const REPORT_PATH = "docs/gigsync/intent-eval.md";
const EXIT_BROKEN = 1;
const DECIMAL = 10;
/** "YYYY-MM-DD" from an ISO timestamp. */
const ISO_DAY = 10;
const SET_COLUMN = 10;
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const { values: args } = parseArgs({
  options: {
    "keywords-only": { type: "boolean", default: false },
    limit: { type: "string" },
    lang: { type: "string" },
    split: { type: "string" },
    timeout: { type: "string" },
    webllm: { type: "string" },
    out: { type: "string" },
    json: { type: "string" },
  },
});

function fail(message) {
  console.error(message);
  process.exit(EXIT_BROKEN);
}

function selected() {
  let cases;
  try {
    cases = loadCases();
  } catch (error) {
    if (error instanceof DataError) fail(`broken eval data: ${error.message}`);
    throw error;
  }
  if (args.lang !== undefined && !(args.lang in SETS)) fail(`--lang must be one of ${Object.keys(SETS).join(", ")}`);
  if (args.lang !== undefined) cases = cases.filter((c) => c.set === args.lang);
  if (args.split !== undefined && !(args.split in Split)) fail(`--split must be ${Object.keys(Split).join(" or ")}`);
  if (args.split !== undefined) cases = cases.filter((c) => splitOf(c.id) === args.split);
  const limit = args.limit === undefined ? undefined : Number.parseInt(args.limit, DECIMAL);
  if (limit !== undefined && !(limit > 0)) fail("--limit must be a positive number");
  return limit === undefined ? cases : cases.slice(0, limit);
}

/** One line per set and router, for the terminal. */
function summary(results, routers) {
  const groups = new Map([...groupBy(results, (r) => r.case.set), ["all", results]]);
  for (const [set, list] of groups) {
    const parts = routers.map((router) => {
      const { right, of } = accuracy(list, router);
      return `${router} ${Math.round(percent(right, of))}%`;
    });
    console.log(`${set.padEnd(SET_COLUMN)} ${String(list.length).padStart(3)} cases  ${parts.join("  ")}`);
  }
}

// Core logs every routed message at info; the eval's own output is the report.
core.configureLog({ LOG_LEVEL: process.env.LOG_LEVEL ?? core.LogLevel.warn });
const cases = selected();
const withModel = !args["keywords-only"];
const webllm = withModel && args.webllm ? await openWebLlm(args.webllm) : undefined;
if (withModel && !webllm && !(await ollamaReady()))
  fail(`Ollama at ${OLLAMA_URL} has no ${OLLAMA_MODEL}; start it and pull the model, or pass --keywords-only`);
const engine = webllm ? `\`${webllm.name}\` in WebLLM on this computer's GPU` : `\`${OLLAMA_MODEL}\` via Ollama`;

const timeoutMs = args.timeout === undefined ? core.MODEL_ROUTE_TIMEOUT_MS : Number.parseInt(args.timeout, DECIMAL);
if (!(timeoutMs > 0)) fail("--timeout must be a positive number of milliseconds");
const results = await runAll(cases, {
  withModel,
  timeoutMs,
  onProgress: (done, total) => process.stderr.isTTY && process.stderr.write(`\r${done}/${total}`),
  ask: remembering(webllm?.ask ?? askOllama),
});
await webllm?.close();
if (process.stderr.isTTY) process.stderr.write("\n");

const routers = withModel ? Object.values(Router) : [Router.keywords];
summary(results, routers);

if (args.json) {
  const rows = results.map(({ case: c, ...routers }) => ({ id: c.id, set: c.set, intent: c.intent, ...routers }));
  writeFileSync(args.json, `${JSON.stringify({ engine, timeoutMs, results: rows })}\n`);
}
const partial = [args.limit, args.lang, args.split, args.timeout].some((arg) => arg !== undefined);
if (!partial || args.out) {
  const date = new Date().toISOString().slice(0, ISO_DAY);
  const out = args.out ?? REPORT_PATH;
  writeFileSync(args.out ?? REPORT, `${report(results, { withModel, engine, timeoutMs, date })}\n`);
  // Biome formats only files inside the repo; a report written elsewhere stays as written.
  if (!args.out) execFileSync("pnpm", ["exec", "biome", "format", "--write", out], { cwd: ROOT, stdio: "ignore" });
  console.log(`wrote ${out}`);
}
