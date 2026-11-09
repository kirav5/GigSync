// Summarises a model run again from its samples (runs/model-*/step-*.jsonl), with the current summary's columns:
//   pnpm --filter @gigsync/load-tests load:report -- runs/<model run>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Sample } from "./model/ollama.js";
import { printSteps, summarise } from "./model/summary.js";

const STEP_FILE = /^step-(\d+)\.jsonl$/;
const dir = process.argv[2];
if (!dir) throw new Error("usage: report.ts <model run directory>");
const setup = JSON.parse(readFileSync(join(dir, "setup.json"), "utf8")) as {
  seconds: number;
  network: { p50: number };
};
const summaries = readdirSync(dir)
  .flatMap((f) => {
    const m = f.match(STEP_FILE);
    return m ? [{ file: f, concurrency: Number(m[1]) }] : [];
  })
  .sort((a, b) => a.concurrency - b.concurrency)
  .map(({ file, concurrency }) => {
    const samples = readFileSync(join(dir, file), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Sample);
    return summarise(concurrency, samples, setup.seconds, setup.network.p50, []);
  });
printSteps(summaries);
writeFileSync(join(dir, "report.json"), JSON.stringify(summaries, null, 2));
