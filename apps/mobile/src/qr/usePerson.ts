import { log, type MessageKey } from "@gigsync/core";
import type { QrCode, QrPerson } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { type Account, apiClient } from "../adapters/account.js";
import { qrErrorKey } from "./problems.js";

/** Who a scanned or opened QR finds: undefined while looking, the person, or why they could not be found. */
export type Found = { person: QrPerson } | { problem: MessageKey } | undefined;

/** Looks the code up once per code, as the signed-in owner. */
export function usePerson(account: Account, code: QrCode): Found {
  const [found, setFound] = useState<Found>();
  useEffect(() => {
    let live = true;
    setFound(undefined);
    apiClient(account.session)
      .lookupQr(code)
      .then((person) => live && setFound({ person }))
      .catch((err: unknown) => {
        log.warn("qr lookup failed", { error: err instanceof Error ? err.message : String(err) });
        if (live) setFound({ problem: qrErrorKey(err) });
      });
    return () => {
      live = false;
    };
  }, [account.session, code]);
  return found;
}
