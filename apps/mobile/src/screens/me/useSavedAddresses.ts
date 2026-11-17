import { listAddresses, log, type Ports } from "@gigsync/core";
import type { SavedAddress } from "@gigsync/protocol";
import { useEffect, useState } from "react";

/** A household's saved addresses (ADR 0045), read once from this phone; undefined until read. */
export function useSavedAddresses(ports: Ports): readonly SavedAddress[] | undefined {
  const [saved, setSaved] = useState<readonly SavedAddress[]>();
  useEffect(() => {
    let live = true;
    listAddresses(ports.storage)
      .then((all) => live && setSaved(all))
      .catch((err: unknown) => log.warn("addresses unread", { error: err instanceof Error ? err.name : String(err) }));
    return () => {
      live = false;
    };
  }, [ports]);
  return saved;
}
