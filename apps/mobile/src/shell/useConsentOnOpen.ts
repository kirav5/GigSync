import { ConsentOnOpen, consentOnOpen, log, type Ports } from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";
import type { Account } from "../adapters/account.js";
import { recordsClient } from "../adapters/records.js";

/**
 * An owner signed in before the sign-in line (ADR 0039 §4) agreed by using GigSync: recorded once on opening the app,
 * with no screen in the way. True while the one line saying so (and that the terms are in Settings) should show.
 */
export function useConsentOnOpen(ports: Ports, account: Account): { said: boolean; dismiss: () => void } {
  const [said, setSaid] = useState(false);
  useEffect(() => {
    let live = true;
    consentOnOpen(recordsClient(account.session), ports.storage)
      .then((outcome) => live && setSaid(outcome === ConsentOnOpen.recorded))
      .catch((err: unknown) => log.warn("agreement on open not recorded", { error: String(err) }));
    return () => {
      live = false;
    };
  }, [ports, account.session]);
  const dismiss = useCallback(() => setSaid(false), []);
  return { said, dismiss };
}
