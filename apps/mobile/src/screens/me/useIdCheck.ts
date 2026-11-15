import { log, type Ports } from "@gigsync/core";
import { useEffect, useState } from "react";
import { loadIdCheck } from "../../adapters/idcheck.js";

/** Whether this phone holds a passed ID check (the Aadhaar QR, screens/verify), read once; false until read. */
export function useIdChecked(ports: Ports): boolean {
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let live = true;
    loadIdCheck(ports.storage)
      .then((check) => live && setChecked(check !== undefined))
      .catch((err: unknown) => log.warn("id check unread", { error: err instanceof Error ? err.name : String(err) }));
    return () => {
      live = false;
    };
  }, [ports]);
  return checked;
}
