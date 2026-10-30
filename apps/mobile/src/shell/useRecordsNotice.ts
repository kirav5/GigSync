import { agreeToRecords, log, noticeDue, type Ports } from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";
import type { Account } from "../adapters/account.js";
import { recordsClient } from "../adapters/records.js";

/**
 * Whether to show the notice about job records now (ADR 0038 §5): at sign-up, and once to an owner already signed in
 * who has not answered it, here or on another phone. "Not now" hides it until the app opens again.
 */
export function useRecordsNotice(
  ports: Ports,
  account: Account,
): { due: boolean; agree: () => Promise<void>; later: () => void } {
  // Not shown until known, so an owner who agreed never sees it flash.
  const [due, setDue] = useState(false);

  useEffect(() => {
    let live = true;
    noticeDue(recordsClient(account.session), ports.storage)
      .then((show) => live && setDue(show))
      .catch((err: unknown) => log.warn("records notice check failed", { error: String(err) }));
    return () => {
      live = false;
    };
  }, [ports, account.session]);

  const agree = useCallback(async () => {
    await agreeToRecords(recordsClient(account.session), ports.storage);
    log.info("records notice agreed");
    setDue(false);
  }, [ports, account.session]);

  return { due, agree, later: () => setDue(false) };
}
