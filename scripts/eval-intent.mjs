// The chat intent eval (ADR 0040 §6): every phrasing in vectors/intents through the word lists, the phone's model
// (Ollama in development) and the chain the app runs, with a generated report in docs/gigsync/intent-eval.md.
// Run with `pnpm eval:intent` (builds core first). Options:
//   --keywords-only   skip the language model, for CI without Ollama
//   --no-meaning      skip the embedding model (ADR 0042), for a run without its download
//   --limit N         only the first N cases (after --lang)
//   --lang SET        only one set: en, hi, kn or hinglish
// A run with --limit or --lang prints its numbers and leaves the report alone. Exits non-zero only when a data file
// is broken or Ollama is not there for a model run, never on a low score.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DataError, loadCases, SETS } from "./eval-intent/cases.mjs";
import { core } from "./eval-intent/core.mjs";
import { EMBEDDING_MODEL, loadMeaning } from "./eval-intent/embedder.mjs";
import { OLLAMA_MODEL, OLLAMA_URL, ollamaReady } from "./eval-intent/ollama.mjs";
import { report } from "./eval-intent/report.mjs";
import { routersOf, runAll } from "./eval-intent/run.mjs";
import { accuracy, groupBy, percent } from "./eval-intent/score.mjs";

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
    "no-meaning": { type: "boolean", default: false },
    limit: { type: "string" },
    lang: { type: "string" },
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
if (withModel && !(await ollamaReady()))
  fail(`Ollama at ${OLLAMA_URL} has no ${OLLAMA_MODEL}; start it and pull the model, or pass --keywords-only`);

const meaning = args["no-meaning"] ? undefined : await loadMeaning();
if (!args["no-meaning"] && !meaning)
  fail("@huggingface/transformers is not installed; run pnpm install, or pass --no-meaning");

const timeoutMs = core.MODEL_ROUTE_TIMEOUT_MS;
const results = await runAll(cases, {
  withModel,
  meaning,
  timeoutMs,
  onProgress: (done, total) => process.stderr.isTTY && process.stderr.write(`\r${done}/${total}`),
});
if (process.stderr.isTTY) process.stderr.write("\n");

const routers = routersOf({ withModel, meaning });
summary(results, routers);

const partial = args.limit !== undefined || args.lang !== undefined;
if (!partial) {
  const date = new Date().toISOString().slice(0, ISO_DAY);
  const meta = {
    withModel,
    routers,
    model: OLLAMA_MODEL,
    embedding: meaning ? EMBEDDING_MODEL : undefined,
    timeoutMs,
    date,
  };
  writeFileSync(REPORT, `${report(results, meta)}\n`);
  execFileSync("pnpm", ["exec", "biome", "format", "--write", REPORT_PATH], { cwd: ROOT, stdio: "ignore" });
  console.log(`wrote ${REPORT_PATH}`);
}
