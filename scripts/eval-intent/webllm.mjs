// The phone's own engine for the eval: WebLLM running one of the app's model builds on this computer's GPU, in a
// Chromium driven by Playwright (from tests/ui), with the request the app's web engine sends (the plugin's built
// `completionRequest`). Its answers are the phone's; its times are this computer's GPU, not a phone's.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url);
const testsRequire = createRequire(new URL("tests/ui/package.json", ROOT));
const webllmRequire = createRequire(new URL("plugins/gigsync-llm/package.json", ROOT));
const { completionRequest } = await import(new URL("plugins/gigsync-llm/dist/request.js", ROOT).href);
const { MODEL } = await import(new URL("plugins/gigsync-llm/dist/catalog.js", ROOT).href);

const LIBRARY = webllmRequire.resolve("@mlc-ai/web-llm");
const LIBRARY_PATH = "/web-llm.js";
const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { CreateMLCEngine } from "${LIBRARY_PATH}";
window.load = async (id) => { window.engine = await CreateMLCEngine(id); };
window.ask = async (request) => (await window.engine.chat.completions.create(request)).choices[0].message.content;
</script>`;
const JS = "text/javascript";
const HTML = "text/html";
/**
 * A lasting browser profile: a throwaway one has too small a storage quota for a 1 GB model, and this one keeps the
 * models between runs, as a phone keeps them.
 */
const PROFILE = join(tmpdir(), "gigsync-eval-webllm");
/** First download included: a 2B model is about 1 GB. */
const LOAD_LIMIT_MS = 1_800_000;

/** A browser with `id` loaded, and the eval's `ask` for it; `close()` when done. */
export async function openWebLlm(id) {
  if (!Object.values(MODEL.ids).includes(id)) throw new Error(`${id} is not in the plugin's catalog`);
  const spec = MODEL;
  const server = createServer((req, res) => {
    const library = req.url === LIBRARY_PATH;
    res.setHeader("content-type", library ? JS : HTML);
    res.end(library ? readFileSync(LIBRARY) : PAGE);
  });
  await new Promise((done) => server.listen(0, done));
  const { chromium } = testsRequire("@playwright/test");
  // Headed: headless Chromium on a Mac may offer no WebGPU adapter.
  const browser = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    args: ["--enable-unsafe-webgpu"],
  });
  const page = browser.pages()[0] ?? (await browser.newPage());
  page.setDefaultTimeout(LOAD_LIMIT_MS);
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => typeof window.load === "function");
  await page.evaluate((model) => window.load(model), id);

  const ask = async (prompt, options, call) => {
    try {
      const reply = await page.evaluate((r) => window.ask(r), completionRequest({ prompt, ...options }, spec.thinks));
      call.reply = reply?.trim() || null;
      return call.reply;
    } catch (error) {
      call.error = error.name;
      return null;
    }
  };
  const close = async () => {
    await browser.close();
    server.close();
  };
  return { name: id, ask, close };
}
