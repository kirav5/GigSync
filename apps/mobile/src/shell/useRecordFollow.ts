import { followRecord, type GigDevice, log } from "@gigsync/core";
import { useEffect, useRef } from "react";
import type { Account } from "../adapters/account.js";
import { recordsClient } from "../adapters/records.js";

/** How often a signed-in phone reads the owner's record for jobs the other side ended there. */
const FOLLOW_MS = 60_000;
const VISIBLE = "visible";

/**
 * Keeps this phone's jobs in step with the owner's GigSync record: a job the other side ended through the record
 * (their phone rebuilt it and could not message) moves on here too, within a minute and whenever the app comes back to
 * the front. `refresh` shows the change.
 */
export function useRecordFollow(device: GigDevice, account: Account, refresh: () => void): void {
  const latest = useRef({ device, refresh });
  latest.current = { device, refresh };
  const session = account.session;
  useEffect(() => {
    const follow = () =>
      followRecord(recordsClient(session), latest.current.device.store, new Date())
        .then((moved) => moved > 0 && latest.current.refresh())
        .catch((err: unknown) =>
          log.warn("following the record failed", { error: err instanceof Error ? err.name : typeof err }),
        );
    const onVisible = () => document.visibilityState === VISIBLE && void follow();
    void follow();
    const timer = setInterval(() => void follow(), FOLLOW_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);
}
