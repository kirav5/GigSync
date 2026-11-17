# The GigSync connector (MCP), locally

ADR 0068. Tries the connector against the UI tests' API, never the pilot's data.
1. API on 8796, with its own throwaway Postgres (see `workers/api/test/database.mjs`):

   ```bash
   cd workers/api && E2E_DATABASE=gigsync_e2e_mcp E2E_API_PORT=8796 E2E_INSPECTOR_PORT=9246 E2E_APP_ORIGIN=http://localhost:5186 E2E_STATE_DIR=.wrangler/e2e-mcp pnpm dev:e2e
   ```

2. Connector on 8797: copy `workers/mcp/.dev.vars.example` to `.dev.vars`, then `npx wrangler dev --port 8797` in
   `workers/mcp`.

3. From Claude Code (a local client, so `http://localhost` is fine):

   ```bash
   claude mcp add --transport http gigsync http://localhost:8797/mcp
   ```

   Then `/mcp` in Claude Code, pick gigsync, and sign in with a number that has an account on this API and the dev
   code.

4. From claude.ai or ChatGPT, which need a public https address: run a quick tunnel
   (`cloudflared tunnel --url http://localhost:8797`), set `PUBLIC_ORIGIN` in `.dev.vars` to its address, restart the
   connector, and add `<address>/mcp` as a custom connector.
