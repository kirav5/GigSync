// One target through the teacher and the checks, and the run's files (ADR 0065 §5): every kept example and every
// dropped one with its reason, appended as they come so a stopped run loses nothing, then the training and dev
// splits and a manifest that says how the data was made.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judge } from "./check.mjs";
import { LABEL_SCHEMA, labelPrompt, RECIPE_VERSION, WRITE_SCHEMA, writePrompt } from "./prompts.mjs";

/** The writer is free (many ways of saying the same thing); the labeller is not (the same message, the same marks). */
export const WRITE_OPTIONS = { schema: WRITE_SCHEMA, temperature: 0.9, maxTokens: 200 };
export const LABEL_OPTIONS = { schema: LABEL_SCHEMA, temperature: 0, maxTokens: 200 };

export const Files = {
  kept: "examples.jsonl",
  dropped: "dropped.jsonl",
  train: "train.jsonl",
  dev: "dev.jsonl",
  manifest: "manifest.json",
  /** What the run set out to do, written when it starts, for the dashboard. */
  run: "run.json",
};
/** One example in this many goes to dev, by its number, so the split is the same on every run of the same targets. */
const DEV_EVERY = 10;

/** One target written, labelled and judged: `{ example }` or `{ dropped, message?, label? }`. */
export async function makeOne(target, ask) {
  const written = await ask(writePrompt(target), WRITE_OPTIONS);
  const message = typeof written?.message === "string" ? written.message.trim() : "";
  const label = message ? await ask(labelPrompt(message, target.asking, target.lang), LABEL_OPTIONS) : null;
  const judged = judge(target, written, label);
  return judged.example ? judged : { ...judged, ...(message ? { message } : {}), ...(label ? { label } : {}) };
}

const readLines = (path) =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];

/** The target numbers a run in `dir` has done already, kept or dropped. */
export function doneIds(dir) {
  return new Set([...readLines(join(dir, Files.kept)), ...readLines(join(dir, Files.dropped))].map((r) => r.id));
}

/** Records one target's outcome in `dir`. */
export function record(dir, target, outcome) {
  if (outcome.example)
    appendFileSync(join(dir, Files.kept), `${JSON.stringify({ id: target.id, ...outcome.example })}\n`);
  else appendFileSync(join(dir, Files.dropped), `${JSON.stringify({ id: target.id, ...outcome, target })}\n`);
}

const countBy = (items, keyOf) =>
  items.reduce((counts, item) => {
    for (const key of [keyOf(item)].flat()) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

/** Writes the splits and the manifest from what `dir` holds; returns the manifest. */
export function finish(dir, settings) {
  const kept = readLines(join(dir, Files.kept)).sort((a, b) => a.id - b.id);
  const dropped = readLines(join(dir, Files.dropped));
  const dev = kept.filter((e) => e.id % DEV_EVERY === 0);
  const train = kept.filter((e) => e.id % DEV_EVERY !== 0);
  const lines = (items) => items.map((e) => JSON.stringify(e)).join("\n") + (items.length > 0 ? "\n" : "");
  writeFileSync(join(dir, Files.train), lines(train));
  writeFileSync(join(dir, Files.dev), lines(dev));
  const manifest = {
    ...settings,
    recipe_version: RECIPE_VERSION,
    targets: kept.length + dropped.length,
    kept: kept.length,
    train: train.length,
    dev: dev.length,
    dropped: countBy(dropped, (d) => d.dropped),
    kept_by_turn: countBy(kept, (e) => e.turn),
    kept_by_slot: countBy(kept, (e) => e.spans.map((s) => s.slot)),
    finished_at: new Date().toISOString(),
  };
  writeFileSync(join(dir, Files.manifest), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
