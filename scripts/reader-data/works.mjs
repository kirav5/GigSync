// The kind of work each kept example is about, for the reader's work head (ADR 0065): the target it was written for is
// drawn again from the run's seed, so a run needs no teacher to gain it. Writes next to the run's files:
//   works.json    the kinds of work in the head's order (the trades, then the kinds), from protocol
//   works.jsonl   one line per kept example: its number and kind of work, or null when the message does not say it
// Run with `node scripts/reader-data/works.mjs --out data/reader/v1`; `pnpm reader:train` runs it first.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { protocol } from "./core.mjs";
import { langOf } from "./languages.mjs";
import { GROUP_WORDS } from "./phrases.mjs";
import { Files } from "./run.mjs";
import { drawTarget } from "./sample.mjs";

const Turn = protocol.TurnKind.enum;
const Slot = protocol.ReaderSlot.enum;
export const WORKS_LIST = "works.json";
export const WORKS = "works.jsonl";

/** The head's classes, in order. */
export const workKinds = () => [...protocol.Trade.options, ...protocol.WorkCategory.options];

/**
 * The work a message says, as the reader should learn it: a need or a price question that names the work or describes
 * the job. Not an answer (the work is known by then and the writer was told not to name it), not a need named only by
 * its group ("home repairs" is a group, opened as one), and not a need that says neither.
 */
export function workOf(target, example) {
  const says = (slot) => example.spans.some((s) => s.slot === slot);
  if (target.turn === Turn.market && says(Slot.kind)) return target.kind;
  if (target.turn !== Turn.need) return null;
  if (GROUP_WORDS.some((g) => g.words === target.slots.kind)) return null;
  return says(Slot.kind) || says(Slot.what) ? target.kind : null;
}

const lines = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { out: { type: "string" } } });
  const dir = values.out ?? "data/reader/v1";
  const { seed, lang } = JSON.parse(readFileSync(join(dir, Files.run), "utf8"));
  const draw = (id) => drawTarget(seed, id, langOf(lang));
  const rows = lines(join(dir, Files.kept)).map((e) => ({ id: e.id, work: workOf(draw(e.id), e) }));
  writeFileSync(join(dir, WORKS_LIST), `${JSON.stringify(workKinds())}\n`);
  writeFileSync(join(dir, WORKS), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  const named = rows.filter((r) => r.work).length;
  const drift = lines(join(dir, Files.kept)).filter((e) => draw(e.id).turn !== e.turn).length;
  if (drift > 0) throw new Error(`${drift} examples do not match the targets drawn again: another seed or recipe?`);
  console.log(`${rows.length} examples, ${named} with a kind of work, ${workKinds().length} kinds`);
}
