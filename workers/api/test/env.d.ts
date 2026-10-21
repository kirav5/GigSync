// `env` in `cloudflare:test` is typed as the global Cloudflare.Env (what `wrangler types` would generate).
import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import type { Env as WorkerEnv } from "../src/index.ts";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
