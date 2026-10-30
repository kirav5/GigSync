import { defineConfig } from "@playwright/test";

/** The app as `pnpm dev:app` serves it, and the API as `pnpm dev:workers` runs it (against Neon). */
const APP = process.env.APP_URL ?? "http://localhost:5173";
const API = process.env.API_BASE ?? "http://localhost:8787";
const STARTUP_MS = 120_000;
/**
 * Spec files run one at a time unless PW_WORKERS says otherwise: they share the local API and Neon, so more at once is
 * faster but worth checking before relying on it. Tests inside one file always run in order.
 */
const WORKERS = Number(process.env.PW_WORKERS ?? 1);

export default defineConfig({
  testDir: "test",
  // One journey crosses to Neon dozens of times; the agents need a few syncs per step.
  timeout: 600_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  workers: WORKERS,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: APP,
    headless: true,
    // The journeys: tall enough that every step fits on one screen, as the app scrolls inside its own panel, not the
    // page. layout.spec.ts sets a 360×640 phone itself, and install.spec.ts an iPhone.
    viewport: { width: 400, height: 1400 },
    deviceScaleFactor: 2,
  },
  // Chrome's engine and Safari's, as Playwright ships them (`pnpm exec playwright install chromium webkit`): a
  // Homebrew or downloaded Chrome may be quarantined by macOS and refuse to start headless. Pick one with --project.
  // Chromium runs as the full browser in its new headless mode, not the lighter headless shell: the shell has no
  // speech service, and its renderer crashes on `SpeechRecognition.available()`, which Talk calls on every visit.
  projects: [
    { name: "chromium", use: { browserName: "chromium", channel: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: [
    {
      command: "pnpm --filter @gigsync/worker-api dev",
      url: `${API}/health`,
      reuseExistingServer: true,
      timeout: STARTUP_MS,
    },
    { command: "pnpm --filter @gigsync/mobile dev", url: APP, reuseExistingServer: true, timeout: STARTUP_MS },
  ],
});
