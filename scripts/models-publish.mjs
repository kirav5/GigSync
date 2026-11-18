// Puts a model bundle (`pnpm models:bundle --out`, ADR 0065) on GigSync's model host, a Cloudflare R2 bucket, for the
// web to fetch: every file of it under <version>/, the manifest beside the two models' folders. A version is never
// overwritten: browsers keep what they fetched by its address, so new models are a new version and a new
// VITE_MODELS_URL (the MODELS_URL repository variable in CI).
//   pnpm models:publish --bundle data/models/v6 --version v6
// Needs `wrangler login` (or CLOUDFLARE_API_TOKEN) for the account that holds the bucket. Options:
//   --bucket B   the bucket, default gigsync-models
//   --dry-run    check the bundle and print what would be uploaded
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { protocol } from "./reader-data/core.mjs";

const MANIFEST = "manifest.json";
const TYPES = { ".json": "application/json", ".onnx": "application/octet-stream" };
/** A version's files never change, so browsers and the CDN may keep them for good. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const DEFAULT_BUCKET = "gigsync-models";
const VERSION = /^v\d+$/;
const MB = 1024 * 1024;

const { values } = parseArgs({
  options: {
    bundle: { type: "string" },
    version: { type: "string" },
    bucket: { type: "string", default: DEFAULT_BUCKET },
    "dry-run": { type: "boolean" },
  },
});
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!values.bundle || !values.version) fail("Usage: pnpm models:publish --bundle data/models/v6 --version v6");
if (!VERSION.test(values.version)) fail(`The version is v and a number, not ${values.version}.`);
if (!existsSync(join(values.bundle, MANIFEST)))
  fail(`${values.bundle} has no ${MANIFEST}: write it with pnpm models:bundle --out first.`);
const manifest = protocol.ModelBundle.safeParse(JSON.parse(readFileSync(join(values.bundle, MANIFEST), "utf8")));
if (!manifest.success) fail(`${join(values.bundle, MANIFEST)} is not a bundle's manifest.`);

const filesIn = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)],
  );
const files = filesIn(values.bundle);
const strange = files.filter((f) => !TYPES[extname(f)]);
if (strange.length > 0) fail(`Not part of a bundle: ${strange.join(", ")}.`);

const wrangler = (...args) =>
  execFileSync("pnpm", ["--filter", "@gigsync/worker-api", "exec", "wrangler", ...args], { stdio: "inherit" });
for (const file of files) {
  const key = `${values.bucket}/${values.version}/${relative(values.bundle, file).split("\\").join("/")}`;
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
      TYPES[extname(file)],
      "--cache-control",
      CACHE_CONTROL,
    );
}
console.log(`\nSet the web build to read it: VITE_MODELS_URL=<the bucket's public address>/${values.version}/`);
