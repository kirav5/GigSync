// The generated report (docs/gigsync/intent-eval.md): headline accuracy, the breakdowns, slots, the model's
// fallbacks, latency, and the cases where the model and the word lists disagree.
import { core } from "./core.mjs";
import { Router } from "./run.mjs";
import { accuracy, groupBy, P50, P95, percent, percentile, slotAccuracy, slotsByName } from "./score.mjs";

const NONE = "—";
const ALL = "all";
const TOP_MISTAKES = 10;
const INTENTS = Object.values(core.ChatIntent);

const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
const row = (cells) => `| ${cells.map(cell).join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)];
const pct = (part, whole) => {
  const p = percent(part, whole);
  return p === undefined ? NONE : `${Math.round(p)}% (${part}/${whole})`;
};
const ms = (v) => (v === undefined ? NONE : `${Math.round(v)} ms`);
const said = (result) => (result?.intent ? result.intent : (result?.fallback ?? NONE));

function accuracyRows(groups, routers) {
  return [...groups].map(([key, results]) => [
    key,
    results.length,
    ...routers.map((router) => {
      const { right, of } = accuracy(results, router);
      return of === 0 ? NONE : pct(right, of);
    }),
  ]);
}

/** Results by expected intent, in the order core lists the intents. */
function byIntent(results) {
  const groups = groupBy(results, (r) => r.case.intent);
  return new Map(INTENTS.filter((intent) => groups.has(intent)).map((intent) => [intent, groups.get(intent)]));
}

function breakdowns(results, routers) {
  const head = (first) => [first, "Cases", ...routers];
  const sets = new Map([...groupBy(results, (r) => r.case.set), [ALL, results]]);
  return [
    "## Intent accuracy by language set",
    "",
    ...table(head("Set"), accuracyRows(sets, routers)),
    "",
    "## Intent accuracy by intent",
    "",
    "Recall: of the cases that expect this intent, how many each router named it for.",
    "",
    ...table(head("Expected intent"), accuracyRows(byIntent(results), routers)),
    "",
    "## By source",
    "",
    "`list`: today's word lists get the case right; `miss`: written to probe what they miss.",
    "",
    ...table(
      head("Source"),
      accuracyRows(
        groupBy(results, (r) => r.case.source),
        routers,
      ),
    ),
  ];
}

function slotRows(results, routers) {
  const tallies = routers.map((router) => slotsByName(results, router));
  const names = [...new Set(tallies.flatMap((t) => [...t.keys()]))].sort();
  return names.map((name) => [
    name,
    ...tallies.map((t) => (t.has(name) ? pct(t.get(name).hits, t.get(name).total) : NONE)),
  ]);
}

function slots(results, routers) {
  const rows = routers.map((router) => {
    const s = slotAccuracy(results, router);
    return [router, pct(s.hits, s.total), pct(s.whole, s.of)];
  });
  return [
    "## Slots",
    "",
    "Slot accuracy counts the expected slots filled with the expected value, in cases whose intent was right (a note",
    "matches when either text holds the other). The last column is the share of all cases right in intent and slots.",
    "",
    ...table(["Router", "Slot accuracy", "Intent and every slot right"], rows),
    "",
    "By slot, in cases whose intent each router got right:",
    "",
    ...table(["Slot", ...routers], slotRows(results, routers)),
  ];
}

function fallbacks(results) {
  const model = results.map((r) => r[Router.model]);
  const fell = model.filter((m) => !m.intent);
  const reasons = [...groupBy(fell, (m) => m.fallback)].map(([reason, list]) => [reason, list.length]);
  const byModel = results.filter((r) => r[Router.combined].via === core.RouteVia.model);
  return [
    "## Model fallbacks",
    "",
    `The model router gave no route for ${pct(fell.length, model.length)} of cases. The reasons are inferred from the`,
    "model's raw reply (scripts/eval-intent/fallback.mjs), since core only logs that it rejected one. In the combined",
    `router the model's route was used for ${pct(byModel.length, results.length)} of cases; the word lists answered the`,
    "rest. The combined run reuses the model-only run's reply to the same prompt (the router asks at temperature 0).",
    "",
    ...(reasons.length > 0 ? table(["Reason", "Cases"], reasons) : []),
  ];
}

function latency(results, routers) {
  const of = (pick) => results.map(pick).filter((v) => v !== undefined);
  const line = (name, values) => [
    name,
    ms(percentile(values, P50)),
    ms(percentile(values, P95)),
    ms(Math.max(...values)),
  ];
  const rows = routers.map((router) =>
    line(
      router,
      of((r) => r[router]?.ms),
    ),
  );
  if (routers.includes(Router.model))
    rows.push(
      line(
        "model, raw call",
        of((r) => r[Router.model].rawMs),
      ),
    );
  return [
    "## Latency",
    "",
    "Wall time per message on the machine that ran the eval, not a phone. The model router stops waiting at its time",
    "limit; the raw call is how long the engine took to answer anyway. The combined run reuses the model-only run's",
    "reply, so its times are the word lists' share only.",
    "",
    ...table(["Router", "p50", "p95", "max"], rows),
  ];
}

function disagreements(title, note, list, other) {
  const rows = list.map((r) => [r.case.id, r.case.text, r.case.intent, said(r[other])]);
  return [
    `## ${title}`,
    "",
    note,
    "",
    ...(rows.length > 0 ? table(["Case", "Text", "Expected", `${other} said`], rows) : ["None."]),
  ];
}

function mistakes(results, router) {
  const wrong = results.filter((r) => r[router] && !r[router].ok);
  const pairs = [...groupBy(wrong, (r) => `${r.case.intent} → ${said(r[router])}`)]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, TOP_MISTAKES)
    .map(([pair, list]) => [pair, list.length, list.map((r) => r.case.id).join(", ")]);
  return [
    `### ${router}`,
    "",
    ...(pairs.length > 0 ? table(["Expected → said", "Cases", "Ids"], pairs) : ["None."]),
    "",
  ];
}

function modelSections(results) {
  const kw = Router.keywords;
  const gains = results.filter((r) => r[Router.model].ok && !r[kw].ok);
  const losses = results.filter((r) => !r[Router.model].ok && r[kw].ok);
  const chainLosses = results.filter((r) => !r[Router.combined].ok && r[kw].ok);
  return [
    ...fallbacks(results),
    "",
    ...disagreements("Model right, word lists wrong", "What the model adds.", gains, kw),
    "",
    ...disagreements("Word lists right, model wrong", "Where the model alone would regress.", losses, Router.model),
    "",
    ...disagreements(
      "Word lists right, combined wrong",
      "Regressions the shipped chain would bring.",
      chainLosses,
      Router.combined,
    ),
  ];
}

/** The whole report, as Markdown. */
export function report(results, meta) {
  const routers = meta.routers;
  const parts = [
    ...(meta.embedding ? [`embedding model \`${meta.embedding}\` (ADR 0042)`] : []),
    ...(meta.withModel ? [`language model ${meta.engine}, time limit ${meta.timeoutMs} ms`] : []),
  ];
  const mode = parts.length > 0 ? parts.join("; ") : "word lists only (`--keywords-only --no-meaning`)";
  return [
    "# Chat intent eval",
    "",
    "Generated by `pnpm eval:intent` (scripts/eval-intent.mjs); do not edit by hand. See ADR 0040 §6 and ADR 0042.",
    "",
    `Run on ${meta.date}: ${mode}; ${results.length} cases from \`vectors/intents\`.`,
    "",
    ...breakdowns(results, routers),
    "",
    ...slots(results, routers),
    "",
    ...latency(results, routers),
    "",
    ...(meta.withModel ? [...modelSections(results), ""] : []),
    "## Most common mistakes",
    "",
    ...routers.flatMap((router) => mistakes(results, router)),
  ].join("\n");
}
