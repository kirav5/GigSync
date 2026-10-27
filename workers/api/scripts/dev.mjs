// Runs `wrangler dev` against the Neon directory. Locally, Hyperdrive connects straight to the database named by
// CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DIRECTORY; this fills it from DATABASE_URL_UNPOOLED, which
// `neon env pull` writes to the repo's .env.local (loaded by the `dev` script), unless it is already set.
import { spawn } from "node:child_process";

const LOCAL_URL_VAR = "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DIRECTORY";
const NEON_URL_VAR = "DATABASE_URL_UNPOOLED";

process.env[LOCAL_URL_VAR] ??= process.env[NEON_URL_VAR];
if (!process.env[LOCAL_URL_VAR]) {
  console.error(`No directory database: run \`neon env pull\` in the repo root, or set ${LOCAL_URL_VAR}.`);
  process.exit(1);
}

const wrangler = spawn("wrangler", ["dev", ...process.argv.slice(2)], { stdio: "inherit" });
wrangler.on("exit", (code) => process.exit(code ?? 1));
