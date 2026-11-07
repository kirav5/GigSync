import { log } from "@gigsync/core";
import type { FindEvent, Session } from "@gigsync/protocol";
import { apiClient } from "../adapters/account.js";

/** One more in Find's daily counts (ADR 0060). Nobody waits on it, and a count that fails is simply not counted. */
export function countFind(session: Session, event: FindEvent | undefined): void {
  if (!event) return;
  apiClient(session)
    .countFind(event)
    .catch((err: unknown) => log.warn("find count failed", { error: err instanceof Error ? err.name : typeof err }));
}
