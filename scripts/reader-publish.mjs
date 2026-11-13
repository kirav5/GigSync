// Puts a trained reader (ADR 0065) on GigSync's model host, a Cloudflare R2 bucket, for phones to fetch with the
// understanding pack: its labels and its 8-bit ONNX file, under reader/<version>/. A version is never overwritten:
// phones keep what they fetched by its address, so a new reader is a new version and a new VITE_READER_URL.
//   pnpm reader:publish --model data/reader/model-v3 --version v3
// Needs `wrangler login` (or CLOUDFLARE_API_TOKEN) for the account that holds the bucket. Options:
//   --bucket B   the bucket, default gigsync-models
//   --dry-run    check the model and print what would be uploaded
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { protocol } from "./reader-data/core.mjs";

const FILES = [
  { path: "labels.json", type: "application/json" },
  { path: "onnx/model_quantized.onnx", type: "application/octet-stream" },
];
/** A version's files never change, so phones and the CDN may keep them for good. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const DEFAULT_BUCKET = "gigsync-models";
const VERSION = /^v\d+$/;
const MB = 1024 * 1024;

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    version: { type: "string" },
    bucket: { type: "string", default: DEFAULT_BUCKET },
    "dry-run": { type: "boolean" },
  },
});
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!values.model || !values.version) fail("Usage: pnpm reader:publish --model data/reader/model-v3 --version v3");
if (!VERSION.test(values.version)) fail(`The version is v and a number, not ${values.version}.`);
for (const f of FILES)
  if (!existsSync(join(values.model, f.path))) fail(`${values.model} has no ${f.path}: train and export it first.`);

// A kind of work the reader names that protocol does not would be read as none on every phone: refuse it.
const labels = JSON.parse(readFileSync(join(values.model, "labels.json"), "utf8"));
const unknown = labels.works.filter((w) => !protocol.ReaderWork.safeParse(w).success);
if (unknown.length > 0) fail(`The reader names work protocol does not: ${unknown.join(", ")}.`);
const known = new Set(labels.works);
const missing = protocol.ReaderWork.options.flatMap((o) => o.options ?? [o.value]).filter((w) => !known.has(w));
if (missing.length > 0) console.warn(`Kinds the reader never learned (they go to the matchers): ${missing.join(", ")}`);

const wrangler = (...args) =>
  execFileSync("pnpm", ["--filter", "@gigsync/worker-api", "exec", "wrangler", ...args], { stdio: "inherit" });
for (const f of FILES) {
  const key = `${values.bucket}/reader/${values.version}/${f.path}`;
  const file = join(values.model, f.path);
  console.log(`${key} (${(statSync(file).size / MB).toFixed(1)} MB)`);
  if (!values["dry-run"])
    wrangler(
      "r2",
      "object",
      "put",
      key,
      "--file",
      file,
      "--remote",
      "--content-type",
      f.type,
      "--cache-control",
      CACHE_CONTROL,
    );
}
console.log(`\nSet the app's build to read it: VITE_READER_URL=<the bucket's public address>/reader/${values.version}`);
