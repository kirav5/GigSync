// Serves model bundles (`pnpm models:bundle --out`) on this computer, as GigSync's model host serves them, so the web
// app can be tried locally with the phone's models (ADR 0065 amendment, 2026-11-16):
//   pnpm models:serve                       # serves data/models on http://localhost:8791
//   VITE_MODELS_URL=http://localhost:8791/v6/ pnpm --filter @gigsync/mobile exec vite --port 5174
// Options:
//   --dir DIR    the folder of bundles, default data/models
//   --port N     default 8791
// Only GET and HEAD, only files under the folder, and only on this computer (localhost).
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const DEFAULT_DIR = "data/models";
const DEFAULT_PORT = "8791";
const HOST = "127.0.0.1";
const TYPES = { ".json": "application/json", ".onnx": "application/octet-stream" };
const Method = { get: "GET", head: "HEAD", options: "OPTIONS" };
const READ_METHODS = new Set([Method.get, Method.head]);
const NO_CONTENT = 204;
const NOT_ALLOWED = 405;
const NOT_FOUND = 404;
const OK = 200;

const { values } = parseArgs({
  options: { dir: { type: "string", default: DEFAULT_DIR }, port: { type: "string", default: DEFAULT_PORT } },
});
const root = resolve(values.dir);
if (!existsSync(root)) {
  console.error(`${values.dir} does not exist: write a bundle with pnpm models:bundle --out ${values.dir}/v6 first.`);
  process.exit(1);
}

/** The file a request names, or undefined for anything outside the folder or not a bundle's file. */
function fileOf(url) {
  let path;
  try {
    path = normalize(decodeURIComponent(new URL(url, "http://localhost").pathname));
  } catch {
    return undefined;
  }
  const file = join(root, path);
  if (!file.startsWith(root + sep) || !TYPES[extname(file)]) return undefined;
  return existsSync(file) && statSync(file).isFile() ? file : undefined;
}

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === Method.options) return res.writeHead(NO_CONTENT).end();
  if (!READ_METHODS.has(req.method ?? "")) return res.writeHead(NOT_ALLOWED).end();
  const file = fileOf(req.url ?? "/");
  if (!file) return res.writeHead(NOT_FOUND).end();
  res.writeHead(OK, { "Content-Type": TYPES[extname(file)], "Content-Length": statSync(file).size });
  if (req.method === Method.head) return res.end();
  createReadStream(file).pipe(res);
}).listen(Number(values.port), HOST, () => console.log(`serving ${values.dir} on http://localhost:${values.port}`));
