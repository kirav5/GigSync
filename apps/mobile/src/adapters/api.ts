/**
 * Where the app finds workers/api. Vite bakes VITE_API_BASE into the build, so the website and the phone apps each
 * get the address they were built with. Dev falls back to `pnpm dev:workers`; a production build without it has no API.
 */
export const API_BASE: string | undefined =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || (import.meta.env.DEV ? "http://localhost:8787" : undefined);
