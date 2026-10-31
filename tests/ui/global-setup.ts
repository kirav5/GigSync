import { execFileSync } from "node:child_process";
import { API, E2E_API } from "./stack.js";

/**
 * Before every run on the tests' own API: no job records from an earlier run, as they would move the market ranges
 * the specs expect (ADR 0039 §1). The API's own script does it, as only it knows the database. Skipped for the dev
 * servers (a phone spec on Neon), which this must never touch.
 */
export default function globalSetup() {
  if (API !== E2E_API) return;
  execFileSync("pnpm", ["--filter", "@gigsync/worker-api", "exec", "node", "scripts/e2e.mjs", "--reset-jobs"], {
    stdio: "inherit",
  });
}
