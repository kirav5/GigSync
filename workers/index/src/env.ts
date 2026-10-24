import type { IndexHub } from "./hub.ts";
import type { DB } from "./store.ts";

export interface Env {
  DB: DB;
  HUB: DurableObjectNamespace<IndexHub>;
  JETSTREAM: string;
  RELAY: string;
  /** Logging settings, read by @gigsync/core/log; see the README's Logs section. */
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  LOG_PII?: string;
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);
