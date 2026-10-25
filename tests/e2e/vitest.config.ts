import { defineConfig } from "vitest/config";

// Every request crosses to the API and on to Neon, so one journey takes many seconds; files run one at a time so
// their devices never compete for the same sign-in limits.
export default defineConfig({
  test: { include: ["test/**/*.e2e.ts"], testTimeout: 300_000, hookTimeout: 300_000, fileParallelism: false },
});
