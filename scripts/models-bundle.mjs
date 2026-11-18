// Makes the phone's two models one bundle (ADR 0065 amendment, 2026-11-15): the trimmed embedding model and the reader
// trimmed to the same pieces (training/reader/trim.py), with a manifest naming them. The same bundle serves every
// build, so the web and the phone read with the same models:
//   - a native app carries it under models/ beside its own files, and reads from its first launch, offline, with
//     nothing to download. Run it after the web build and before `cap sync`, never for the website's own build, which
//     would have every visitor fetch it with the page:
//       pnpm build && pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim \
//         && pnpm --filter @gigsync/mobile exec cap sync android
//   - the web fetches it from GigSync's model host, a folder per version (VITE_MODELS_URL): write it alone with --out,
//     then publish it (`pnpm models:publish`), or serve it locally to try the web app with it:
//       pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim --out data/models/v6
// Options:
//   --app DIR   the built app to put it in, default apps/mobile/dist
//   --out DIR   write the bundle into DIR alone instead (a folder of its own, for a host or to share)
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { protocol } from "./reader-data/core.mjs";

const MODELS = "models";
const MANIFEST = "manifest.json";
const READER = "reader";
const TRIM = "trim.json";
const LABELS = "labels.json";
const WEIGHTS = "onnx/model_quantized.onnx";
const EMBEDDER_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", WEIGHTS];
const READER_FILES = [LABELS, WEIGHTS];
const DEFAULT_APP = "apps/mobile/dist";
const MB = 1024 * 1024;

const { values } = parseArgs({
  options: {
    embedder: { type: "string" },
    reader: { type: "string" },
    app: { type: "string", default: DEFAULT_APP },
    out: { type: "string" },
  },
});
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!values.embedder || !values.reader)
  fail("Usage: pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim [--out DIR]");
if (!values.out && !existsSync(join(values.app, "index.html")))
  fail(`${values.app} has no app build: run pnpm build first, or write the bundle alone with --out.`);

const trimOf = (dir) => {
  if (!existsSync(join(dir, TRIM))) fail(`${dir} was not trimmed: run training/reader/trim.py on it.`);
  return JSON.parse(readFileSync(join(dir, TRIM), "utf8"));
};
const [embedderTrim, readerTrim] = [trimOf(values.embedder), trimOf(values.reader)];
// The reader reads the embedding model's tokens: one trimmed with other pieces would read every message wrong.
if (JSON.stringify(embedderTrim.kept) !== JSON.stringify(readerTrim.kept))
  fail("The embedder and the reader were trimmed to different pieces: trim both in one run of trim.py.");

// A kind of work the reader names that protocol does not would be read as none on every phone: refuse it.
if (!existsSync(join(values.reader, LABELS))) fail(`Missing ${join(values.reader, LABELS)}.`);
const labels = JSON.parse(readFileSync(join(values.reader, LABELS), "utf8"));
const unknown = labels.works.filter((w) => !protocol.ReaderWork.safeParse(w).success);
if (unknown.length > 0) fail(`The reader names work protocol does not: ${unknown.join(", ")}.`);
const known = new Set(labels.works);
const missing = protocol.ReaderWork.options.flatMap((o) => o.options ?? [o.value]).filter((w) => !known.has(w));
if (missing.length > 0) console.warn(`Kinds the reader never learned (they go to the matchers): ${missing.join(", ")}`);

const out = values.out ?? join(values.app, MODELS);
// The folder is emptied first: refuse one that holds anything but an earlier bundle.
if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, MANIFEST)))
  fail(`${out} is not empty and holds no bundle: give a folder of its own.`);
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
