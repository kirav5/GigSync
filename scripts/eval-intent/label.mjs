// Sets each case's `source` from what today's word lists say: "list" when they name the expected intent, "miss"
// when they do not. Run after adding cases (`node scripts/eval-intent/label.mjs`); it checks every file first and
// rewrites only the files whose labels changed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contextOf, DataError, loadCases } from "./cases.mjs";
import { core } from "./core.mjs";

const VECTORS = new URL("../../vectors/intents/", import.meta.url);
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** A slot object or list on one line, as the files are written: `{ "trade": "cook" }`, `["Ravi", "Asha"]`. */
const inline = (v) =>
  Array.isArray(v)
    ? `[${v.map(inline).join(", ")}]`
    : v && typeof v === "object"
      ? `{ ${Object.entries(v)
          .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
          .join(", ")} }`
      : JSON.stringify(v);
const caseText = (c) =>
  `    {\n${Object.entries(c)
    .map(([k, v]) => `      ${JSON.stringify(k)}: ${inline(v)}`)
    .join(",\n")}\n    }`;
const fileText = (data) => `{\n  "cases": [\n${data.cases.map(caseText).join(",\n")}\n  ]\n}\n`;

let cases;
try {
  cases = loadCases();
} catch (error) {
  if (!(error instanceof DataError)) throw error;
  console.error(`broken eval data: ${error.message}`);
  process.exit(1);
}
const expected = new Map(
  cases.map((c) => [c.id, core.keywordRoute(c.text, contextOf(c))?.intent === c.intent ? "list" : "miss"]),
);
const files = [...new Set(cases.map((c) => `${c.set}/${c.file}`))];
let changed = 0;
const rewritten = [];
for (const file of files) {
  const url = new URL(file, VECTORS);
  const data = JSON.parse(readFileSync(url, "utf8"));
  let dirty = false;
  for (const c of data.cases) {
    const source = expected.get(c.id);
    if (c.source !== source) {
      c.source = source;
      dirty = true;
      changed += 1;
    }
  }
  if (!dirty) continue;
  writeFileSync(url, fileText(data));
  rewritten.push(fileURLToPath(url));
}
// Back into the repo's JSON style, as `pnpm lint` checks it.
if (rewritten.length > 0)
  execFileSync("pnpm", ["exec", "biome", "format", "--write", ...rewritten], { cwd: ROOT, stdio: "ignore" });
console.log(`${cases.length} cases in ${files.length} files; ${changed} labels changed`);
