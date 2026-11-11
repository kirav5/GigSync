import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type Rolldown } from "vite";

const SW_SOURCE = new URL("./sw/sw.js", import.meta.url);
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const INDEX = "index.html";
const ASSETS = "assets/";
const SOURCE_MAP = ".map";
/** Cloudflare reads this file at deploy and never serves it, so it is no part of what the app precaches. */
const REDIRECTS = "_redirects";
/** What only the website loads: an app that opens offline has no use for it, and a phone should not pay for it. */
const WEBSITE_ONLY = /^assets\/(home-|story-|site-links-|community-mural-|mural-)/;
/** The on-device model's engine (WebLLM, about 12 MB in two files): fetched on its first use, never precached. */
const MODEL_ENGINE = "/@mlc-ai/web-llm/";
const MODEL_WORKER = `${ASSETS}model-worker-`;

/** WebLLM's chunk and the worker that runs it: only phones that download the model ever fetch them. */
function modelEngine(file: Rolldown.OutputChunk | Rolldown.OutputAsset): boolean {
  if (file.type === "asset") return file.fileName.startsWith(MODEL_WORKER);
  return file.moduleIds.some((id) => id.includes(MODEL_ENGINE));
}

/**
 * Writes sw.js into the build with the app shell it precaches: ./app (where the web serves index.html), the manifest
 * and icons (everything in public/), and every emitted file under assets/ except source maps, the website's own files
 * and the on-device model's engine (the worker caches that on its first fetch, when the owner downloads the model).
 * The cache is named by a hash of those names and index.html, so each release gets its own cache and the browser sees a changed worker.
 */
function serviceWorker(): Plugin {
  return {
    name: "gigsync-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_output, bundle) {
        const built = Object.entries(bundle)
          .filter(
            ([f, file]) =>
              f.startsWith(ASSETS) && !f.endsWith(SOURCE_MAP) && !WEBSITE_ONLY.test(f) && !modelEngine(file),
          )
          .map(([f]) => f);
        const copied = readdirSync(PUBLIC, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name !== REDIRECTS)
          .map((entry) => relative(PUBLIC, join(entry.parentPath, entry.name)).split(sep).join("/"));
        const shell = ["./app", ...[...copied, ...built].sort().map((f) => `./${f}`)];
        const page = bundle[INDEX];
        const html = page?.type === "asset" ? String(page.source) : "";
        const cache = createHash("sha256").update(shell.join("\n")).update(html).digest("hex").slice(0, 12);
        const source = readFileSync(SW_SOURCE, "utf8")
          .replaceAll("__CACHE__", () => cache)
          .replaceAll("__SHELL__", () => JSON.stringify(shell));
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Capacitor loads the build from the app bundle, so asset paths must be relative.
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    // The app (index.html, what Capacitor loads) and the website's two pages: home.html, the web's root
    // (public/_redirects), and story.html, served at /story.
    rollupOptions: { input: { app: INDEX, home: "home.html", story: "story.html" } },
  },
  // The model's Web Worker under a name the service worker can leave out of its precache.
  worker: { format: "es", rollupOptions: { output: { entryFileNames: `${MODEL_WORKER}[hash].js` } } },
  server: { port: 5173, host: true },
});
