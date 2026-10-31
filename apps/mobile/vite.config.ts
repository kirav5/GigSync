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
const SITES = "website/sites/";
const HTML = ".html";

/** Every page under website/sites/, keyed by its file name, so the switcher's iframes have something to load. */
function websiteSites(): Record<string, string> {
  const dir = fileURLToPath(new URL(`./${SITES}`, import.meta.url));
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith(HTML))
      .map((name) => [`site-${name.slice(0, -HTML.length)}`, `${SITES}${name}`]),
  );
}

/**
 * Writes sw.js into the build with the app shell it precaches: ./, index.html, the manifest and icons (everything in
 * public/), and every emitted file under assets/ except source maps. The cache is named by a hash of those names and
 * index.html, so each release gets its own cache and the browser sees a changed worker.
 */
function serviceWorker(): Plugin {
  return {
    name: "gigsync-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_output, bundle) {
        const built = Object.keys(bundle).filter((f) => f.startsWith(ASSETS) && !f.endsWith(SOURCE_MAP));
        const copied = readdirSync(PUBLIC, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => relative(PUBLIC, join(entry.parentPath, entry.name)).split(sep).join("/"));
        const shell = ["./", `./${INDEX}`, ...[...copied, ...built].sort().map((f) => `./${f}`)];
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
    // The app (index.html, what Capacitor loads), the worker-facing site (home.html), and the "what we are building"
    // switcher (website.html, served at /website) with the whole sites it switches between under website/sites/.
    rollupOptions: { input: { app: INDEX, home: "home.html", website: "website.html", ...websiteSites() } },
  },
  server: { port: 5173, host: true },
});
