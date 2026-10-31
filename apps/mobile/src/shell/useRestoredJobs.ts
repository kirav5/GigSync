import { type GigDevice, log, restoreFromRecord } from "@gigsync/core";
import { useEffect, useRef } from "react";
import type { Account } from "../adapters/account.js";
import { recordsClient } from "../adapters/records.js";

/**
 * A phone with no jobs for this owner gets their jobs back from their record on GigSync, once per signed-in owner, as
 * restored jobs (structured facts only). `refresh` shows them. A job already here is never overwritten.
 */
export function useRestoredJobs(device: GigDevice, account: Account, refresh: () => void): void {
  const latest = useRef({ device, refresh });
  latest.current = { device, refresh };
  const owner = account.session.user;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `owner` only exists to run this once per signed-in owner.
  useEffect(() => {
    const { device: now } = latest.current;
    restoreFromRecord(recordsClient(account.session), now.store, owner)
      .then((added) => added > 0 && latest.current.refresh())
      .catch((err: unknown) =>
        log.warn("restoring jobs failed", { error: err instanceof Error ? err.name : typeof err }),
      );
  }, [owner]);
}
