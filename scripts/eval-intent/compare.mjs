// Model comparison tables from several eval runs (`pnpm eval:intent --json FILE` each), for
// docs/gigsync/model-comparison.md: accuracy with 95% intervals, by language set and by intent, slots, latency, a
// paired test between two runs, and how often two builds of one model agree.
//   node scripts/eval-intent/compare.mjs [--split dev|test] [--pair A,B]... label=run.json ...
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { splitOf } from "./cases.mjs";
import { P50, P95, percentile } from "./score.mjs";

const PERCENT = 100;
/** z for a two-sided 95% interval. */
const Z95 = 1.96;
const SETS = ["en", "hi", "hinglish", "kn", "kanglish"];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { pair: { type: "string", multiple: true, default: [] }, split: { type: "string" } },
});
/** Every run cut to the same cases: the chosen split, and only cases every run has. */
const loaded = positionals.map((arg) => {
  const [label, file] = arg.split("=");
  return { label, ...JSON.parse(readFileSync(file, "utf8")) };
});
const idSets = loaded.map((run) => new Set(run.results.map((r) => r.id)));
const common = new Set([...idSets[0]].filter((id) => idSets.every((ids) => ids.has(id))));
const runs = loaded.map((run) => ({
  ...run,
  results: run.results.filter((r) => common.has(r.id) && (!values.split || splitOf(r.id) === values.split)),
}));
const byLabel = new Map(runs.map((r) => [r.label, r]));

const row = (cells) => `| ${cells.join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row), ""];
const pct = (p) => `${Math.round(PERCENT * p)}%`;

/** Wilson score interval for `right` of `of`, as "61% (58–64)". */
function withInterval(right, of) {
  if (of === 0) return "—";
  const p = right / of;
  const z2 = Z95 * Z95;
  const centre = (p + z2 / (2 * of)) / (1 + z2 / of);
  const half = (Z95 * Math.sqrt((p * (1 - p)) / of + z2 / (4 * of * of))) / (1 + z2 / of);
  return `${pct(p)} (${Math.round(PERCENT * (centre - half))}–${Math.round(PERCENT * (centre + half))})`;
}

const acc = (rows, router) => rows.filter((r) => r[router]?.ok).length / Math.max(rows.length, 1);
const ofSet = (run, set) => run.results.filter((r) => r.set === set);

function headline() {
  const head = [
    "Run",
    "Model alone (95% CI)",
    "With word lists",
    "Word lists only",
    ...SETS.map((s) => `${s} (model)`),
  ];
  return table(
    head,
    runs.map((run) => {
      const n = run.results.length;
      const right = run.results.filter((r) => r.model?.ok).length;
      return [
        run.label,
        withInterval(right, n),
        pct(acc(run.results, "combined")),
        pct(acc(run.results, "keywords")),
        ...SETS.map((s) => pct(acc(ofSet(run, s), "model"))),
      ];
    }),
  );
}

function bySetCombined() {
  return table(
    ["Run", ...SETS],
    runs.map((run) => [run.label, ...SETS.map((s) => pct(acc(ofSet(run, s), "combined")))]),
  );
}

function byIntent() {
  const intents = [...new Set(runs[0].results.map((r) => r.intent))];
  return table(
    ["Intent", "Cases", ...runs.map((r) => r.label)],
    intents.map((intent) => {
      const n = runs[0].results.filter((r) => r.intent === intent).length;
      return [
        intent,
        n,
        ...runs.map((run) =>
          pct(
            acc(
              run.results.filter((r) => r.intent === intent),
              "model",
            ),
          ),
        ),
      ];
    }),
  );
}

function slots() {
  return table(
    ["Run", "Slots right, where the intent was", "Intent and every slot right"],
    runs.map((run) => {
      const right = run.results.filter((r) => r.model?.ok);
      const hits = right.reduce((s, r) => s + r.model.hits, 0);
      const total = right.reduce((s, r) => s + r.model.total, 0);
      const whole = right.filter((r) => r.model.hits === r.model.total).length;
      return [run.label, total ? pct(hits / total) : "—", pct(whole / run.results.length)];
    }),
  );
}

function latency() {
  return table(
    ["Run", "Engine", "p50", "p95", "No route (model alone)"],
    runs.map((run) => {
      const times = run.results.map((r) => r.model?.rawMs).filter((t) => t !== undefined);
      const fell = run.results.filter((r) => !r.model?.intent).length;
      const ms = (p) => `${Math.round(percentile(times, p) ?? 0)} ms`;
      return [run.label, run.engine, ms(P50), ms(P95), pct(fell / run.results.length)];
    }),
  );
}

/** Exact two-sided sign test on the cases only one of two runs got right (McNemar's test, exact). */
function signTest(b, c) {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let tail = 0;
  let term = 0.5 ** n;
  for (let i = 0; i <= k; i++) {
    tail += term;
    term = (term * (n - i)) / (i + 1);
  }
  return Math.min(1, 2 * tail);
}

function pairs() {
  const rows = values.pair.map((spec) => {
    const [a, b] = spec.split(",").map((l) => byLabel.get(l));
    const other = new Map(b.results.map((r) => [r.id, r]));
    const both = a.results.filter((r) => other.has(r.id));
    const onlyA = both.filter((r) => r.model?.ok && !other.get(r.id).model?.ok).length;
    const onlyB = both.filter((r) => !r.model?.ok && other.get(r.id).model?.ok).length;
    const same = both.filter((r) => r.model?.intent === other.get(r.id).model?.intent).length;
    const p = signTest(onlyA, onlyB);
    return [
      `${a.label} vs ${b.label}`,
      both.length,
      onlyA,
      onlyB,
      p < 0.001 ? "< 0.001" : p.toFixed(3),
      pct(same / both.length),
    ];
  });
  return rows.length === 0
    ? []
    : table(
        ["Pair", "Cases", "Only the first right", "Only the second right", "p (exact McNemar)", "Same intent named"],
        rows,
      );
}

console.log(
  [
    "### Intent accuracy, model alone",
    "",
    ...headline(),
    "### With the word lists behind the model (what the app runs), by set",
    "",
    ...bySetCombined(),
    "### Recall by intent, model alone",
    "",
    ...byIntent(),
    "### Slots",
    "",
    ...slots(),
    "### Speed on this computer",
    "",
    ...latency(),
    ...(values.pair.length ? ["### Paired comparisons", "", ...pairs()] : []),
  ].join("\n"),
);
