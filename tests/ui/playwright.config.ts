import { defineConfig } from "@playwright/test";

/** The app as `pnpm dev:app` serves it, and the API as `pnpm dev:workers` runs it (against Neon). */
const APP = process.env.APP_URL ?? "http://localhost:5173";
const API = process.env.API_BASE ?? "http://localhost:8787";
const STARTUP_MS = 120_000;

export default defineConfig({
  testDir: "test",
  // One journey crosses to Neon dozens of times; the agents need a few syncs per step.
  timeout: 600_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: APP,
    headless: true,
    // Tall enough that every step fits on one screen: the app scrolls inside its own panel, not the page.
    viewport: { width: 400, height: 1400 },
    deviceScaleFactor: 2,
  },
  // Chrome's engine and Safari's, as Playwright ships them (`pnpm exec playwright install chromium webkit`): a
  // Homebrew or downloaded Chrome may be quarantined by macOS and refuse to start headless. Pick one with --project.
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
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
