import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const SW_SOURCE = new URL("./sw/sw.js", import.meta.url);
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const INDEX = "index.html";
const ASSETS = "assets/";
const SOURCE_MAP = ".map";
/** Cloudflare reads this file at deploy and never serves it, so it is no part of what the app precaches. */
const REDIRECTS = "_redirects";
/** What only the website loads: an app that opens offline has no use for it, and a phone should not pay for it. */
const WEBSITE_ONLY = /^assets\/(home-|story-|alpha-|site-links-|curves-|flow-|community-mural-|mural-)/;
/**
 * The understanding pack's Web Worker (adapters/embed/worker.ts, with ONNX Runtime and Transformers.js bundled in):
 * fetched when the pack first loads, never precached.
 */
const MODEL_WORKER = `${ASSETS}model-worker-`;
/**
 * pdf.js and its worker (adapters/aadhaarPdf.ts, about 1.5 MB): only someone verifying with an e-Aadhaar PDF needs
 * them, so they are fetched when first used, never precached; the service worker keeps them for offline after that.
 */
const PDF_READER = /^assets\/pdf(\.worker\.min)?-/;

/**
 * Writes sw.js into the build with the app shell it precaches: ./app (where the web serves index.html), the manifest
 * and icons (everything in public/), and every emitted file under assets/ except source maps, the website's own files
 * the understanding pack's worker and pdf.js (the service worker caches those on their first fetch).
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
        const built = Object.keys(bundle).filter(
          (f) =>
            f.startsWith(ASSETS) &&
            !f.endsWith(SOURCE_MAP) &&
            !WEBSITE_ONLY.test(f) &&
            !f.startsWith(MODEL_WORKER) &&
            !PDF_READER.test(f),
        );
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
    // The app (index.html, what Capacitor loads) and the website's pages: home.html, the web's root
    // (public/_redirects), story.html, served at /story, and alpha.html, the earlier home, kept at /alpha.
    rollupOptions: { input: { app: INDEX, home: "home.html", story: "story.html", alpha: "alpha.html" } },
  },
  // The understanding pack's Web Worker under a name the service worker can leave out of its precache.
  worker: { format: "es", rollupOptions: { output: { entryFileNames: `${MODEL_WORKER}[hash].js` } } },
  server: { port: 5173, host: true },
});
