import { createRequire } from "node:module";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./test/database.mjs";

// Hyperdrive's local stand-in for the DIRECTORY binding connects here, as `wrangler dev` would.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DIRECTORY = TEST_DATABASE_URL;

// pg is CommonJS, but the test runner resolves its require() calls without the conditions wrangler's esbuild uses:
// pg-protocol comes back as an ESM file inside a non-module package, and pg-cloudflare as its empty non-Workers stub.
// Point both at the CommonJS builds a deployed Worker gets.
const fromPg = createRequire(createRequire(import.meta.url).resolve("pg"));
const PG_CLOUDFLARE_WORKERS_BUILD = "pg-cloudflare/dist/index.js";
const pgCloudflare = fromPg.resolve("pg-cloudflare/package.json").replace("pg-cloudflare/package.json", "");

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: { bindings: { DEV_OTP: "000000", PHONE_HMAC_KEY: "test-only-key", ADMIN_KEY: "test-only-admin-key" } },
    }),
  ],
  resolve: {
    alias: {
      "pg-protocol": fromPg.resolve("pg-protocol"),
      "pg-cloudflare": `${pgCloudflare}${PG_CLOUDFLARE_WORKERS_BUILD}`,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/database.mjs"],
    // One Postgres for every file, and one test renames a table: files must not run at the same time.
    fileParallelism: false,
  },
});
