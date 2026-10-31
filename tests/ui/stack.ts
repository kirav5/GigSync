/**
 * Where the UI tests find the app and the API. By default their own pair (`dev:e2e` in apps/mobile and workers/api):
 * the app on 5174 talking to an API on 8788 over a local Postgres that is wiped on every start, so test jobs never
 * reach Neon and its market prices (ADR 0039). The phone specs, which drive the dev servers a phone already loads, set
 * APP_URL=http://localhost:5173 and API_BASE=http://localhost:8787 to use `pnpm dev:app` and `pnpm dev:workers`.
 */
/** The tests' own API (`dev:e2e`), whose database the global setup may clear. */
export const E2E_API = "http://localhost:8788";
export const APP = process.env.APP_URL ?? "http://localhost:5174";
export const API = process.env.API_BASE ?? E2E_API;
