// Puts the phone's two models in a native app build (ADR 0065 amendment, 2026-11-15), so the phone reads from its first
// launch, offline, with nothing to download: the trimmed embedding model and the reader trimmed to the same pieces
// (training/reader/trim.py), under models/ beside the app's files (the build ships ONNX Runtime itself). Run it after the web
// build and before `cap sync`, never for the website, which would have every visitor fetch them:
//   pnpm build && pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim \
//     && pnpm --filter @gigsync/mobile exec cap sync android
// Options:
//   --app DIR   the built app, default apps/mobile/dist
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { protocol } from "./reader-data/core.mjs";

const MODELS = "models";
const MANIFEST = "manifest.json";
const READER = "reader";
const TRIM = "trim.json";
const WEIGHTS = "onnx/model_quantized.onnx";
const EMBEDDER_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", WEIGHTS];
const READER_FILES = ["labels.json", WEIGHTS];
const DEFAULT_APP = "apps/mobile/dist";
const MB = 1024 * 1024;

const { values } = parseArgs({
  options: { embedder: { type: "string" }, reader: { type: "string" }, app: { type: "string", default: DEFAULT_APP } },
});
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!values.embedder || !values.reader)
  fail("Usage: pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim");
if (!existsSync(join(values.app, "index.html"))) fail(`${values.app} has no app build: run pnpm build first.`);

const trimOf = (dir) => {
  if (!existsSync(join(dir, TRIM))) fail(`${dir} was not trimmed: run training/reader/trim.py on it.`);
  return JSON.parse(readFileSync(join(dir, TRIM), "utf8"));
};
const [embedderTrim, readerTrim] = [trimOf(values.embedder), trimOf(values.reader)];
// The reader reads the embedding model's tokens: one trimmed with other pieces would read every message wrong.
if (JSON.stringify(embedderTrim.kept) !== JSON.stringify(readerTrim.kept))
  fail("The embedder and the reader were trimmed to different pieces: trim both in one run of trim.py.");

const out = join(values.app, MODELS);
rmSync(out, { recursive: true, force: true });
const embedder = basename(values.embedder);
const copy = (from, to) => {
  if (!existsSync(from)) fail(`Missing ${from}.`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};
for (const f of EMBEDDER_FILES) copy(join(values.embedder, f), join(out, embedder, f));
for (const f of READER_FILES) copy(join(values.reader, f), join(out, READER, f));

const manifest = protocol.ModelBundle.parse({ embedder, reader: basename(values.reader), pieces: embedderTrim.pieces });
writeFileSync(join(out, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
const size = (dir, files) => files.reduce((sum, f) => sum + statSync(join(out, dir, f)).size, 0) / MB;
console.log(
  `bundled in ${out}: ${embedder} ${size(embedder, EMBEDDER_FILES).toFixed(1)} MB, ` +
    `reader ${size(READER, READER_FILES).toFixed(1)} MB (${manifest.pieces} pieces)`,
);
